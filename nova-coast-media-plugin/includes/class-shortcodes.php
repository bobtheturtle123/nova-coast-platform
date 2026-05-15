<?php
defined( 'ABSPATH' ) || exit;

/**
 * Shortcodes for use in Elementor (drag in Shortcode widget and paste the tag).
 *
 * [ncm_library]               — filterable library grid
 * [ncm_download_button id=""] — download button for a specific asset
 * [ncm_user_credits]          — shows credits remaining
 * [ncm_plans_table]           — pricing cards that link to Stripe Checkout
 */
class NCM_Shortcodes {

    private static ?self $instance = null;

    public static function instance(): self {
        if ( null === self::$instance ) self::$instance = new self();
        return self::$instance;
    }

    public function init(): void {
        add_shortcode( 'ncm_library',         [ $this, 'render_library' ] );
        add_shortcode( 'ncm_download_button', [ $this, 'render_download_button' ] );
        add_shortcode( 'ncm_user_credits',    [ $this, 'render_user_credits' ] );
        add_shortcode( 'ncm_plans_table',     [ $this, 'render_plans_table' ] );
    }

    // ── [ncm_library] ─────────────────────────────────────────────────────────

    public function render_library( array $atts ): string {
        $atts = shortcode_atts( [ 'per_page' => 24, 'show_filters' => 'true', 'show_search' => 'true' ], $atts );
        $show_filters = $atts['show_filters'] !== 'false';
        $show_search  = $atts['show_search']  !== 'false';

        $parent_locs = get_terms( [ 'taxonomy' => 'asset_location', 'hide_empty' => true, 'parent' => 0 ] ) ?: [];
        $query = new WP_Query( [ 'post_type' => 'stock_asset', 'post_status' => 'publish', 'posts_per_page' => (int) $atts['per_page'] ] );

        ob_start(); ?>
        <div class="ncm-library-wrap">
            <?php if ( $show_search ) : ?>
            <form class="ncm-search-form" action="" method="get">
                <input type="text" class="ncm-search-input" placeholder="Search La Jolla, aerial, luxury pool…" autocomplete="off">
                <svg class="ncm-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </form>
            <?php endif; ?>
            <?php if ( $show_filters ) : ?>
            <div class="ncm-filter-bar">
                <select class="ncm-filter-location" aria-label="Location">
                    <option value="">All Locations</option>
                    <?php foreach ( $parent_locs as $loc ) : ?>
                        <option value="<?php echo esc_attr($loc->slug); ?>"><?php echo esc_html($loc->name); ?></option>
                        <?php foreach ( get_terms(['taxonomy'=>'asset_location','parent'=>$loc->term_id,'hide_empty'=>true]) ?: [] as $child ) : ?>
                            <option value="<?php echo esc_attr($child->slug); ?>">&mdash; <?php echo esc_html($child->name); ?></option>
                        <?php endforeach; ?>
                    <?php endforeach; ?>
                </select>
                <select class="ncm-filter-type"><option value="">Photos &amp; Videos</option><option value="photo">Photos Only</option><option value="video">Videos Only</option></select>
                <select class="ncm-filter-orientation"><option value="">All Orientations</option><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select>
                <button class="ncm-filter-clear">Clear</button>
            </div>
            <?php endif; ?>
            <div class="ncm-asset-grid">
                <?php while ( $query->have_posts() ) { $query->the_post(); NCM_Library_Query::instance()->render_card_public( get_the_ID() ); } wp_reset_postdata(); ?>
            </div>
            <div class="ncm-load-more-wrap"><?php if ( $query->max_num_pages > 1 ) echo '<button class="ncm-load-more">Load More</button>'; ?></div>
        </div>
        <?php return ob_get_clean();
    }

    // ── [ncm_download_button id="POST_ID"] ────────────────────────────────────

    public function render_download_button( array $atts ): string {
        $atts    = shortcode_atts( [ 'id' => 0, 'label' => '' ], $atts );
        $post_id = (int) $atts['id'];
        if ( ! $post_id || get_post_type( $post_id ) !== 'stock_asset' ) return '';

        $type  = get_field( 'media_type', $post_id );
        $label = $atts['label'] ?: ( $type === 'video' ? 'Download Full Video' : 'Download Full Photo' );

        ob_start();
        if ( is_user_logged_in() ) : ?>
            <div class="ncm-button-wrap">
                <button class="ncm-download-btn" data-asset-id="<?php echo $post_id; ?>" data-original-text="<?php echo esc_attr($label); ?>"><?php echo esc_html($label); ?></button>
                <p class="ncm-credits-display" style="text-align:center;margin-top:8px;font-size:.8125rem;color:#888;">Loading...</p>
            </div>
        <?php else : ?>
            <a href="<?php echo esc_url(wp_login_url(get_permalink())); ?>" class="ncm-download-btn" style="display:inline-block;text-align:center;text-decoration:none;">Sign In to Download</a>
        <?php endif;
        return ob_get_clean();
    }

    // ── [ncm_user_credits] ────────────────────────────────────────────────────

    public function render_user_credits( array $atts ): string {
        if ( ! is_user_logged_in() ) return '';
        $uid  = get_current_user_id();
        $v    = NCM_Subscription_Validator::instance();
        $plan = $v->get_active_plan( $uid );
        $meta = NCM_Credit_System::instance()->get_plan_meta( $uid );
        if ( ! $plan ) {
            return '<p class="ncm-credits-no-plan">No active plan. <a href="#ncm-plans" class="ncm-link-gold">View plans &rarr;</a></p>';
        }
        $remaining = $v->is_unlimited( $plan ) ? 'Unlimited' : $meta['credits_remaining'];
        ob_start(); ?>
        <div class="ncm-user-credits-badge">
            <span class="ncm-credits-count"><?php echo esc_html($remaining); ?></span>
            <span class="ncm-credits-label">downloads remaining</span>
            <span class="ncm-plan-badge"><?php echo esc_html(ucfirst($plan)); ?> Plan</span>
        </div>
        <?php return ob_get_clean();
    }

    // ── [ncm_plans_table] ─────────────────────────────────────────────────────

    public function render_plans_table( array $atts ): string {
        $plans = [
            'starter'   => [ 'name' => 'Starter',  'downloads' => '5 / month',  'price' => '$29' ],
            'growth'    => [ 'name' => 'Growth',    'downloads' => '10 / month', 'price' => '$59' ],
            'pro'       => [ 'name' => 'Pro',       'downloads' => '15 / month', 'price' => '$99', 'featured' => true ],
            'unlimited' => [ 'name' => 'Unlimited', 'downloads' => 'Unlimited',  'price' => '$199' ],
        ];

        ob_start(); ?>
        <div class="ncm-plans-grid" id="ncm-plans">
            <?php foreach ( $plans as $slug => $plan ) : ?>
            <div class="ncm-plan-card <?php echo ! empty($plan['featured']) ? 'ncm-plan-card--featured' : ''; ?>">
                <?php if ( ! empty($plan['featured']) ) echo '<div class="ncm-plan-badge-top">Most Popular</div>'; ?>
                <h3 class="ncm-plan-name"><?php echo esc_html($plan['name']); ?></h3>
                <div class="ncm-plan-price"><?php echo esc_html($plan['price']); ?><span>/mo</span></div>
                <p class="ncm-plan-downloads"><?php echo esc_html($plan['downloads']); ?> downloads</p>
                <ul class="ncm-plan-features">
                    <li>HD &amp; 4K assets</li>
                    <li>Commercial license</li>
                    <li>Instant secure download</li>
                    <li>Cancel anytime</li>
                </ul>
                <?php if ( is_user_logged_in() ) : ?>
                    <button class="ncm-btn ncm-btn--primary ncm-plan-cta ncm-checkout-btn"
                            data-plan="<?php echo esc_attr($slug); ?>">
                        Get <?php echo esc_html($plan['name']); ?>
                    </button>
                <?php else : ?>
                    <a href="<?php echo esc_url(wp_login_url(get_permalink())); ?>" class="ncm-btn ncm-btn--primary ncm-plan-cta">
                        Sign In to Subscribe
                    </a>
                <?php endif; ?>
            </div>
            <?php endforeach; ?>
        </div>
        <?php return ob_get_clean();
    }
}
