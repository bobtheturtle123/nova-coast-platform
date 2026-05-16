<?php
defined( 'ABSPATH' ) || exit;

/**
 * AJAX download handler — the core of the entire download flow.
 *
 * Flow:
 * 1. User clicks Download button (ncm-download-btn)
 * 2. JS sends ncm_request_download AJAX with nonce + asset_id
 * 3. Plugin validates: nonce > logged in > active subscription > credits
 * 4. Generates 5-min signed R2 URL — raw key never leaves server
 * 5. Deducts 1 credit, logs download, returns signed URL to JS
 * 6. JS triggers invisible <a download> click — file downloads directly from R2
 */
class NCM_Download_Handler {
    private static ?self $instance = null;
    public static function instance(): self {
        if ( null === self::$instance ) self::$instance = new self();
        return self::$instance;
    }
    public function init(): void {
        add_action( 'wp_ajax_ncm_request_download',        [ $this, 'handle_download' ] );
        add_action( 'wp_ajax_nopriv_ncm_request_download', [ $this, 'handle_unauth' ] );
        add_action( 'wp_ajax_ncm_get_user_status',         [ $this, 'handle_status' ] );
        add_action( 'wp_ajax_nopriv_ncm_get_user_status',  [ $this, 'handle_status' ] );
    }

    public function handle_download(): void {
        if ( ! check_ajax_referer( 'ncm_download_nonce', 'nonce', false ) ) {
            wp_send_json_error( [ 'code' => 'invalid_nonce', 'message' => 'Security check failed.' ], 403 );
        }
        $uid      = get_current_user_id();
        $asset_id = (int) ( $_POST['asset_id'] ?? 0 );

        if ( ! $uid ) {
            wp_send_json_error( [ 'code' => 'not_logged_in', 'message' => 'Please log in to download assets.' ], 401 );
        }
        if ( ! $asset_id || get_post_type( $asset_id ) !== 'stock_asset' ) {
            wp_send_json_error( [ 'code' => 'invalid_asset', 'message' => 'Asset not found.' ], 404 );
        }

        $validator = NCM_Subscription_Validator::instance();
        if ( ! $validator->has_active_subscription( $uid ) ) {
            wp_send_json_error( [
                'code'        => 'no_subscription',
                'message'     => 'An active subscription is required to download assets.',
                'upgrade_url' => home_url( '/#ncm-plans' ),
            ], 402 );
        }

        $credits = NCM_Credit_System::instance();
        if ( ! $credits->has_credits( $uid ) ) {
            wp_send_json_error( [
                'code'        => 'no_credits',
                'message'     => 'You have used all downloads for this month. Upgrade to get more.',
                'upgrade_url' => home_url( '/#ncm-plans' ),
            ], 402 );
        }

        $key = get_field( 'full_res_url', $asset_id );
        if ( ! $key ) {
            wp_send_json_error( [ 'code' => 'missing_asset', 'message' => 'Asset file not configured.' ], 500 );
        }

        $signed_url = NCM_R2_Storage::instance()->generate_signed_url( $key, 300 );
        if ( ! $signed_url ) {
            wp_send_json_error( [ 'code' => 'r2_error', 'message' => 'Could not generate download link. Please try again.' ], 500 );
        }

        $credits->deduct_credit( $uid );
        $this->log_download( $uid, $asset_id );
        $this->bump_count( $asset_id );

        $meta = $credits->get_plan_meta( $uid );
        wp_send_json_success( [
            'download_url'      => $signed_url,
            'filename'          => $this->filename( $asset_id ),
            'credits_remaining' => $meta['credits_remaining'],
            'plan'              => $meta['plan'],
        ] );
    }

    public function handle_unauth(): void {
        wp_send_json_error( [ 'code' => 'not_logged_in', 'message' => 'Please log in to download assets.', 'login_url' => wp_login_url() ], 401 );
    }

    public function handle_status(): void {
        check_ajax_referer( 'ncm_download_nonce', 'nonce' );
        $uid = get_current_user_id();
        if ( ! $uid ) { wp_send_json_success( [ 'logged_in' => false ] ); return; }
        $v    = NCM_Subscription_Validator::instance();
        $plan = $v->get_active_plan( $uid );
        $meta = NCM_Credit_System::instance()->get_plan_meta( $uid );
        wp_send_json_success( [
            'logged_in'         => true,
            'has_subscription'  => (bool) $plan,
            'plan'              => $plan ?? 'none',
            'credits_remaining' => $plan && $v->is_unlimited( $plan ) ? 'Unlimited' : $meta['credits_remaining'],
            'is_unlimited'      => $plan ? $v->is_unlimited( $plan ) : false,
        ] );
    }

    private function log_download( int $uid, int $asset_id ): void {
        global $wpdb;
        $wpdb->insert( $wpdb->prefix . 'ncm_downloads', [
            'user_id'       => $uid,
            'asset_id'      => $asset_id,
            'downloaded_at' => current_time( 'mysql', true ),
        ], [ '%d', '%d', '%s' ] );
    }

    private function bump_count( int $asset_id ): void {
        $c = (int) get_field( 'download_count', $asset_id );
        update_field( 'download_count', $c + 1, $asset_id );
    }

    private function filename( int $asset_id ): string {
        $slug = sanitize_title( get_the_title( $asset_id ) );
        $ext  = get_field( 'media_type', $asset_id ) === 'video' ? 'mp4' : 'jpg';
        return "nova-coast-{$slug}.{$ext}";
    }
}

