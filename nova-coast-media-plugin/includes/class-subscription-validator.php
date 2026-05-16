<?php
defined( 'ABSPATH' ) || exit;

/**
 * Validates active Stripe subscriptions.
 * Reads from user_meta kept in sync by NCM_Stripe_Handler webhooks.
 * Falls back to a live Stripe API check if meta looks stale.
 */
class NCM_Subscription_Validator {

    private static ?self $instance = null;

    private array $limits = [
        'starter'   => 5,
        'growth'    => 10,
        'pro'       => 15,
        'unlimited' => PHP_INT_MAX,
    ];

    public static function instance(): self {
        if ( null === self::$instance ) self::$instance = new self();
        return self::$instance;
    }

    public function init(): void {
        // Nothing to hook — webhooks drive all state changes via NCM_Stripe_Handler
    }

    // ── Public API ────────────────────────────────────────────────────────────

    public function get_active_plan( int $user_id ): ?string {
        $status = get_user_meta( $user_id, 'ncm_stripe_status', true );
        $plan   = get_user_meta( $user_id, 'ncm_stripe_plan',   true );

        if ( $this->status_is_active( $status ) && $plan ) {
            return $plan;
        }

        // Meta might be stale — do a live check (result is cached 5 min by Stripe handler)
        $sub = NCM_Stripe_Handler::instance()->get_subscription( $user_id );
        if ( ! $sub ) return null;

        $live_status = $sub['status'] ?? '';
        $live_plan   = $sub['metadata']['plan'] ?? '';

        return ( $this->status_is_active( $live_status ) && $live_plan ) ? $live_plan : null;
    }

    public function has_active_subscription( int $user_id ): bool {
        return null !== $this->get_active_plan( $user_id );
    }

    public function get_monthly_limit( string $plan ): int {
        return $this->limits[ $plan ] ?? 0;
    }

    public function is_unlimited( string $plan ): bool {
        return $plan === 'unlimited';
    }

    private function status_is_active( string $status ): bool {
        // Stripe statuses that should allow downloads
        return in_array( $status, [ 'active', 'trialing' ], true );
    }
}
