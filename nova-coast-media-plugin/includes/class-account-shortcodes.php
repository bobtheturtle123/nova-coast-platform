<?php
defined( 'ABSPATH' ) || exit;

/**
 * [ncm_my_downloads]  — user account page shortcode.
 * Paste on a private WordPress page titled "My Account" or similar.
 * Shows: current plan, credits remaining, download history, billing portal button.
 */
add_shortcode( 'ncm_my_downloads', function() {
    if ( ! is_user_logged_in() ) {
        return '<p class="ncm-credits-no-plan">Please <a href="' . esc_url( wp_login_url( get_permalink() ) ) . '" class="ncm-link-gold">sign in</a> to view your account.</p>';
    }

    $uid  = get_current_user_id();
    $v    = NCM_Subscription_Validator::instance();
    $plan = $v->get_active_plan( $uid );
    $meta = NCM_Credit_System::instance()->get_plan_meta( $uid );

    global $wpdb;
    $rows = $wpdb->get_results( $wpdb->prepare(
        "SELECT d.asset_id, d.downloaded_at, p.post_title
         FROM {$wpdb->prefix}ncm_downloads d
         LEFT JOIN {$wpdb->posts} p ON p.ID = d.asset_id
         WHERE d.user_id = %d
         ORDER BY d.downloaded_at DESC
         LIMIT 50",
        $uid
    ) );

    $remaining  = ! $plan ? '—' : ( $v->is_unlimited( $plan ) ? 'Unlimited' : (int) $meta['credits_remaining'] );
    $plan_label = $plan ? ucfirst( $plan ) . ' Plan' : 'No active plan';
    $last_reset = $meta['last_reset'] !== 'never' ? $meta['last_reset'] : '';
    $next_reset = $last_reset
        ? date( 'M j, Y', strtotime( $last_reset . ' +1 month' ) )
        : '—';

    ob_start(); ?>
    <div class="ncm-account-wrap">

        <div class="ncm-account-header">
            <div class="ncm-account-stat">
                <span class="ncm-account-stat__num"><?php echo esc_html( $remaining ); ?></span>
                <span class="ncm-account-stat__label">Downloads Remaining</span>
            </div>
            <div class="ncm-account-stat">
                <span class="ncm-account-stat__num"><?php echo count( $rows ); ?></span>
                <span class="ncm-account-stat__label">Total Downloaded</span>
            </div>
            <div class="ncm-account-stat">
                <span class="ncm-account-stat__num ncm-account-stat__num--plan"><?php echo esc_html( $plan_label ); ?></span>
                <span class="ncm-account-stat__label">Resets <?php echo esc_html( $next_reset ); ?></span>
            </div>
            <div class="ncm-account-stat" style="display:flex;align-items:center;justify-content:center;">
                <?php if ( $plan ) : ?>
                    <button class="ncm-btn ncm-btn--primary ncm-manage-billing" style="font-size:.875rem;padding:11px 24px;">Manage Billing</button>
                <?php else : ?>
                    <a href="<?php echo esc_url( home_url( '/#ncm-plans' ) ); ?>" class="ncm-btn ncm-btn--primary" style="font-size:.875rem;padding:11px 24px;">View Plans</a>
                <?php endif; ?>
            </div>
        </div>

        <h3 class="ncm-account-history-title">Download History</h3>

        <?php if ( empty( $rows ) ) : ?>
            <p style="padding:48px 0;text-align:center;color:var(--ncm-gray-500);">
                No downloads yet.
                <a href="<?php echo esc_url( get_post_type_archive_link( 'stock_asset' ) ); ?>" class="ncm-link-gold">Browse the library &rarr;</a>
            </p>
        <?php else : ?>
        <div class="ncm-account-table-wrap">
            <table class="ncm-account-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Asset</th>
                        <th>Downloaded</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                <?php foreach ( $rows as $i => $row ) :
                    $permalink = get_permalink( $row->asset_id );
                    $thumb_url = esc_url( NCM_R2_Storage::instance()->get_public_url(
                        ncm_get( 'thumbnail_url', $row->asset_id ) ?: ''
                    ) );
                ?>
                <tr>
                    <td class="ncm-table-num"><?php echo $i + 1; ?></td>
                    <td>
                        <div class="ncm-table-asset">
                            <?php if ( $thumb_url ) : ?>
                                <img src="<?php echo $thumb_url; ?>" alt="" class="ncm-table-thumb">
                            <?php endif; ?>
                            <a href="<?php echo esc_url( $permalink ); ?>" class="ncm-link-gold">
                                <?php echo esc_html( $row->post_title ); ?>
                            </a>
                        </div>
                    </td>
                    <td class="ncm-table-date"><?php echo esc_html( date( 'M j, Y', strtotime( $row->downloaded_at ) ) ); ?></td>
                    <td>
                        <button class="ncm-download-btn"
                                data-asset-id="<?php echo (int) $row->asset_id; ?>"
                                data-original-text="Re-download"
                                style="width:auto;margin:0;padding:6px 16px;font-size:.8125rem;">
                            Re-download
                        </button>
                    </td>
                </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php endif; ?>

    </div>
    <?php return ob_get_clean();
} );
