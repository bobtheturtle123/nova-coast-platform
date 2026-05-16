<?php
defined( 'ABSPATH' ) || exit;

/**
 * Per-user download credit system.
 * State stored in user_meta. Resets are triggered by Stripe renewal webhooks.
 */
class NCM_Credit_System {

    private static ?self $instance = null;

    const META_CREDITS    = 'ncm_credits_remaining';
    const META_PLAN       = 'ncm_plan_type';
    const META_RESET_DATE = 'ncm_last_reset_date';

    public static function instance(): self {
        if ( null === self::$instance ) self::$instance = new self();
        return self::$instance;
    }

    public function init(): void {
        // Daily sweep to catch any missed resets (safety net)
        add_action( 'ncm_daily_credit_check', [ $this, 'run_daily_check' ] );
        if ( ! wp_next_scheduled( 'ncm_daily_credit_check' ) ) {
            wp_schedule_event( time(), 'daily', 'ncm_daily_credit_check' );
        }
    }

    public function get_credits( int $uid ): int {
        $this->maybe_reset( $uid );
        return (int) get_user_meta( $uid, self::META_CREDITS, true );
    }

    public function has_credits( int $uid ): bool {
        $plan = NCM_Subscription_Validator::instance()->get_active_plan( $uid );
        if ( ! $plan ) return false;
        if ( NCM_Subscription_Validator::instance()->is_unlimited( $plan ) ) return true;
        return $this->get_credits( $uid ) > 0;
    }

    public function deduct_credit( int $uid ): bool {
        $plan = NCM_Subscription_Validator::instance()->get_active_plan( $uid );
        if ( ! $plan ) return false;
        if ( NCM_Subscription_Validator::instance()->is_unlimited( $plan ) ) return true;
        $remaining = $this->get_credits( $uid );
        if ( $remaining <= 0 ) return false;
        update_user_meta( $uid, self::META_CREDITS, $remaining - 1 );
        return true;
    }

    /**
     * Called by Stripe webhook on subscription creation + monthly renewal.
     */
    public function reset_credits( int $uid ): void {
        $plan = NCM_Subscription_Validator::instance()->get_active_plan( $uid );
        if ( ! $plan ) return;
        $limit = NCM_Subscription_Validator::instance()->get_monthly_limit( $plan );
        update_user_meta( $uid, self::META_CREDITS,    $limit );
        update_user_meta( $uid, self::META_PLAN,       $plan );
        update_user_meta( $uid, self::META_RESET_DATE, gmdate( 'Y-m-d' ) );
    }

    public function get_plan_meta( int $uid ): array {
        $plan = NCM_Subscription_Validator::instance()->get_active_plan( $uid );
        $unlimited = $plan && NCM_Subscription_Validator::instance()->is_unlimited( $plan );
        return [
            'plan'              => $plan ?? 'none',
            'credits_remaining' => $unlimited ? PHP_INT_MAX : $this->get_credits( $uid ),
            'last_reset'        => get_user_meta( $uid, self::META_RESET_DATE, true ) ?: 'never',
            'is_unlimited'      => $unlimited,
        ];
    }

    private function maybe_reset( int $uid ): void {
        $last = get_user_meta( $uid, self::META_RESET_DATE, true );
        if ( ! $last || time() >= strtotime( '+1 month', strtotime( $last ) ) ) {
            $this->reset_credits( $uid );
        }
    }

    public function run_daily_check(): void {
        $users = get_users( [ 'meta_key' => self::META_PLAN, 'fields' => 'ids' ] );
        foreach ( $users as $uid ) $this->maybe_reset( (int) $uid );
    }
}
