<?php
defined( 'ABSPATH' ) || exit;

/**
 * Stripe integration — no SDK required.
 * Handles: Checkout session creation, webhook events, subscription status sync.
 *
 * User meta stored:
 *   ncm_stripe_customer_id      — Stripe cus_xxx
 *   ncm_stripe_subscription_id  — Stripe sub_xxx
 *   ncm_stripe_plan             — starter | growth | pro | unlimited
 *   ncm_stripe_status           — active | canceled | past_due | etc.
 */
class NCM_Stripe_Handler {

    private static ?self $instance = null;

    public static function instance(): self {
        if ( null === self::$instance ) self::$instance = new self();
        return self::$instance;
    }

    public function init(): void {
        // Webhook endpoint: /wp-json/ncm/v1/stripe-webhook
        add_action( 'rest_api_init', [ $this, 'register_webhook_route' ] );

        // Create Checkout session via AJAX
        add_action( 'wp_ajax_ncm_create_checkout', [ $this, 'handle_create_checkout' ] );

        // Customer portal session (manage billing)
        add_action( 'wp_ajax_ncm_create_portal',   [ $this, 'handle_create_portal' ] );
    }

    // ── Stripe API wrapper ────────────────────────────────────────────────────

    public function api( string $method, string $endpoint, array $data = [] ) {
        $secret = $this->secret_key();
        if ( ! $secret ) return false;

        $args = [
            'method'  => strtoupper( $method ),
            'headers' => [
                'Authorization' => 'Bearer ' . $secret,
                'Content-Type'  => 'application/x-www-form-urlencoded',
            ],
            'timeout' => 20,
        ];

        if ( ! empty( $data ) ) {
            $args['body'] = $this->encode( $data );
        }

        $response = wp_remote_request( 'https://api.stripe.com/v1/' . ltrim( $endpoint, '/' ), $args );

        if ( is_wp_error( $response ) ) {
            error_log( 'NCM Stripe error: ' . $response->get_error_message() );
            return false;
        }

        $body = json_decode( wp_remote_retrieve_body( $response ), true );

        if ( isset( $body['error'] ) ) {
            error_log( 'NCM Stripe API error: ' . ( $body['error']['message'] ?? 'unknown' ) );
            return false;
        }

        return $body;
    }

    // ── Create Checkout session ───────────────────────────────────────────────

    public function handle_create_checkout(): void {
        check_ajax_referer( 'ncm_stripe_nonce', 'nonce' );

        $user_id  = get_current_user_id();
        $plan     = sanitize_key( $_POST['plan'] ?? '' );
        $price_id = $this->get_price_id( $plan );

        if ( ! $user_id )   wp_send_json_error( [ 'message' => 'Please log in first.' ] );
        if ( ! $price_id ) wp_send_json_error( [ 'message' => 'Invalid plan.' ] );

        $user        = get_userdata( $user_id );
        $customer_id = get_user_meta( $user_id, 'ncm_stripe_customer_id', true );

        // Create customer if they don't have one yet
        if ( ! $customer_id ) {
            $customer = $this->api( 'POST', 'customers', [
                'email'    => $user->user_email,
                'name'     => $user->display_name,
                'metadata' => [ 'wp_user_id' => $user_id ],
            ] );
            if ( ! $customer ) wp_send_json_error( [ 'message' => 'Could not create customer.' ] );
            $customer_id = $customer['id'];
            update_user_meta( $user_id, 'ncm_stripe_customer_id', $customer_id );
        }

        $success_url = add_query_arg( [ 'ncm_checkout' => 'success', 'session_id' => '{CHECKOUT_SESSION_ID}' ], home_url( '/stock-library/' ) );
        $cancel_url  = add_query_arg( 'ncm_checkout', 'cancel', home_url( '/stock-library/' ) );

        $session = $this->api( 'POST', 'checkout/sessions', [
            'customer'                         => $customer_id,
            'mode'                             => 'subscription',
            'line_items[0][price]'             => $price_id,
            'line_items[0][quantity]'          => 1,
            'success_url'                      => $success_url,
            'cancel_url'                       => $cancel_url,
            'subscription_data[metadata][wp_user_id]' => $user_id,
            'subscription_data[metadata][plan]'       => $plan,
            'allow_promotion_codes'            => 'true',
            'billing_address_collection'       => 'auto',
        ] );

        if ( ! $session ) wp_send_json_error( [ 'message' => 'Could not create checkout session.' ] );

        wp_send_json_success( [ 'checkout_url' => $session['url'] ] );
    }

    // ── Customer portal (manage/cancel subscription) ──────────────────────────

    public function handle_create_portal(): void {
        check_ajax_referer( 'ncm_stripe_nonce', 'nonce' );

        $user_id     = get_current_user_id();
        $customer_id = get_user_meta( $user_id, 'ncm_stripe_customer_id', true );

        if ( ! $user_id || ! $customer_id ) {
            wp_send_json_error( [ 'message' => 'No billing account found.' ] );
        }

        $portal = $this->api( 'POST', 'billing_portal/sessions', [
            'customer'   => $customer_id,
            'return_url' => home_url( '/account/' ),
        ] );

        if ( ! $portal ) wp_send_json_error( [ 'message' => 'Could not open billing portal.' ] );

        wp_send_json_success( [ 'portal_url' => $portal['url'] ] );
    }

    // ── Webhook endpoint ──────────────────────────────────────────────────────

    public function register_webhook_route(): void {
        register_rest_route( 'ncm/v1', '/stripe-webhook', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'process_webhook' ],
            'permission_callback' => '__return_true',
        ] );
    }

    public function process_webhook( WP_REST_Request $request ): WP_REST_Response {
        $payload   = $request->get_body();
        $sig       = $request->get_header( 'stripe-signature' );
        $secret    = $this->webhook_secret();

        if ( $secret ) {
            $event = $this->verify_signature( $payload, $sig, $secret );
            if ( ! $event ) {
                return new WP_REST_Response( [ 'error' => 'Invalid signature' ], 400 );
            }
        } else {
            $event = json_decode( $payload, true );
        }

        $type = $event['type'] ?? '';
        $obj  = $event['data']['object'] ?? [];

        if ( $type === 'customer.subscription.created' || $type === 'customer.subscription.updated' ) {
            $this->sync_subscription( $obj );
        } elseif ( $type === 'customer.subscription.deleted' ) {
            $this->cancel_subscription( $obj );
        } elseif ( $type === 'invoice.payment_succeeded' ) {
            $this->on_renewal( $obj );
        } elseif ( $type === 'invoice.payment_failed' ) {
            $this->on_payment_failed( $obj );
        }

        return new WP_REST_Response( [ 'received' => true ], 200 );
    }

    // ── Subscription sync ─────────────────────────────────────────────────────

    private function sync_subscription( array $sub ): void {
        $user_id = $this->user_id_from_subscription( $sub );
        if ( ! $user_id ) return;

        $plan   = $sub['metadata']['plan'] ?? $this->plan_from_price( $sub['items']['data'][0]['price']['id'] ?? '' );
        $status = $sub['status'] ?? 'unknown';

        update_user_meta( $user_id, 'ncm_stripe_subscription_id', $sub['id'] );
        update_user_meta( $user_id, 'ncm_stripe_plan',            $plan );
        update_user_meta( $user_id, 'ncm_stripe_status',          $status );

        // Give credits when subscription first activates
        if ( $status === 'active' ) {
            NCM_Credit_System::instance()->reset_credits( $user_id );
        }
    }

    private function cancel_subscription( array $sub ): void {
        $user_id = $this->user_id_from_subscription( $sub );
        if ( ! $user_id ) return;

        update_user_meta( $user_id, 'ncm_stripe_status', 'canceled' );
        update_user_meta( $user_id, 'ncm_stripe_plan',   '' );
        delete_user_meta( $user_id, NCM_Credit_System::META_CREDITS );
        delete_user_meta( $user_id, NCM_Credit_System::META_PLAN );
    }

    private function on_renewal( array $invoice ): void {
        $sub_id  = $invoice['subscription'] ?? '';
        if ( ! $sub_id ) return;

        $sub     = $this->api( 'GET', "subscriptions/{$sub_id}" );
        if ( ! $sub ) return;

        $user_id = $this->user_id_from_subscription( $sub );
        if ( ! $user_id ) return;

        // Monthly renewal — reset download credits
        NCM_Credit_System::instance()->reset_credits( $user_id );
    }

    private function on_payment_failed( array $invoice ): void {
        $sub_id  = $invoice['subscription'] ?? '';
        if ( ! $sub_id ) return;
        // Stripe retries automatically — we just mark the status
        $sub = $this->api( 'GET', "subscriptions/{$sub_id}" );
        if ( $sub ) {
            $uid = $this->user_id_from_subscription( $sub );
            if ( $uid ) update_user_meta( $uid, 'ncm_stripe_status', 'past_due' );
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function get_subscription( int $user_id ): ?array {
        $sub_id = get_user_meta( $user_id, 'ncm_stripe_subscription_id', true );
        if ( ! $sub_id ) return null;

        // Check cached status first (avoid API call on every page load)
        $cached = get_transient( "ncm_sub_{$user_id}" );
        if ( $cached !== false ) return $cached;

        $sub = $this->api( 'GET', "subscriptions/{$sub_id}" );
        if ( ! $sub ) return null;

        set_transient( "ncm_sub_{$user_id}", $sub, 300 ); // cache 5 min
        $this->sync_subscription( $sub ); // keep user_meta fresh
        return $sub;
    }

    private function user_id_from_subscription( array $sub ): int {
        // Try metadata first (most reliable)
        $uid = (int) ( $sub['metadata']['wp_user_id'] ?? 0 );
        if ( $uid ) return $uid;

        // Fall back to customer lookup
        $customer_id = $sub['customer'] ?? '';
        if ( ! $customer_id ) return 0;

        $users = get_users( [ 'meta_key' => 'ncm_stripe_customer_id', 'meta_value' => $customer_id, 'fields' => 'ids', 'number' => 1 ] );
        return $users ? (int) $users[0] : 0;
    }

    private function plan_from_price( string $price_id ): string {
        $opts = get_option( 'ncm_stripe_settings', [] );
        foreach ( [ 'starter', 'growth', 'pro', 'unlimited' ] as $plan ) {
            if ( ( $opts["{$plan}_price_id"] ?? '' ) === $price_id ) return $plan;
        }
        return 'starter';
    }

    public function get_price_id( string $plan ): string {
        $opts = get_option( 'ncm_stripe_settings', [] );
        return $opts["{$plan}_price_id"] ?? '';
    }

    private function verify_signature( string $payload, string $sig_header, string $secret ) {
        // Stripe signature verification (HMAC-SHA256)
        $parts = [];
        foreach ( explode( ',', $sig_header ) as $part ) {
            [ $k, $v ] = explode( '=', $part, 2 ) + [ '', '' ];
            $parts[ $k ][] = $v;
        }
        $timestamp = $parts['t'][0] ?? 0;
        $expected  = hash_hmac( 'sha256', "{$timestamp}.{$payload}", $secret );
        foreach ( $parts['v1'] ?? [] as $v ) {
            if ( hash_equals( $expected, $v ) ) {
                return json_decode( $payload, true );
            }
        }
        return false;
    }

    private function secret_key(): string {
        $opts = get_option( 'ncm_stripe_settings', [] );
        return $opts['secret_key'] ?? '';
    }

    private function webhook_secret(): string {
        $opts = get_option( 'ncm_stripe_settings', [] );
        return $opts['webhook_secret'] ?? '';
    }

    // Stripe requires nested array params to be flattened for form encoding
    private function encode( array $data, string $prefix = '' ): string {
        $parts = [];
        foreach ( $data as $k => $v ) {
            $key = $prefix ? "{$prefix}[{$k}]" : $k;
            if ( is_array( $v ) ) {
                $parts[] = $this->encode( $v, $key );
            } else {
                $parts[] = urlencode( $key ) . '=' . urlencode( (string) $v );
            }
        }
        return implode( '&', $parts );
    }

    public function is_configured(): bool {
        return (bool) $this->secret_key();
    }
}
