<?php
defined( 'ABSPATH' ) || exit;

/**
 * Landing page shortcodes.
 * [ncm_hero]         -- full-screen cinematic hero
 * [ncm_features]     -- 3-column feature highlights
 * [ncm_stats]        -- numbers bar (assets, locations, etc.)
 * [ncm_featured_grid] -- curated featured assets grid
 */

// ── Hero ──────────────────────────────────────────────────────────────────────
add_shortcode( 'ncm_hero', function( $atts ) {
    $a = shortcode_atts( [
        'headline'    => 'San Diego Real Estate Media,<br>Built to Sell.',
        'subheadline' => 'Cinematic footage and photography for agents, developers, and marketing teams. License premium local content in seconds.',
        'cta_label'   => 'Browse the Library',
        'cta_url'     => '/stock-library/',
        'cta2_label'  => 'View Plans',
        'cta2_url'    => '#ncm-plans',
        'bg_video'    => '',
        'bg_image'    => '',
    ], $atts );

    ob_start(); ?>
    <section class="ncm-hero">
        <?php if ( $a['bg_video'] ) : ?>
            <video class="ncm-hero__video" autoplay muted loop playsinline>
                <source src="<?php echo esc_url( $a['bg_video'] ); ?>" type="video/mp4">
            </video>
        <?php elseif ( $a['bg_image'] ) : ?>
            <div class="ncm-hero__bg" style="background-image:url('<?php echo esc_url( $a['bg_image'] ); ?>')"></div>
        <?php endif; ?>
        <div class="ncm-hero__overlay"></div>
        <div class="ncm-hero__content">
            <p class="ncm-hero__eyebrow">Nova Coast Media</p>
            <h1 class="ncm-hero__headline"><?php echo wp_kses_post( $a['headline'] ); ?></h1>
            <p class="ncm-hero__sub"><?php echo esc_html( $a['subheadline'] ); ?></p>
            <div class="ncm-hero__actions">
                <a href="<?php echo esc_url( $a['cta_url'] ); ?>" class="ncm-btn-hero ncm-btn-hero--primary">
                    <?php echo esc_html( $a['cta_label'] ); ?>
                </a>
                <a href="<?php echo esc_url( $a['cta2_url'] ); ?>" class="ncm-btn-hero ncm-btn-hero--ghost">
                    <?php echo esc_html( $a['cta2_label'] ); ?>
                </a>
            </div>
        </div>
        <div class="ncm-hero__scroll">
            <span></span>
        </div>
    </section>
    <?php return ob_get_clean();
} );

// ── Stats bar ─────────────────────────────────────────────────────────────────
add_shortcode( 'ncm_stats', function() {
    $total    = wp_count_posts( 'stock_asset' )->publish ?? 0;
    $videos   = (new WP_Query(['post_type'=>'stock_asset','posts_per_page'=>-1,'meta_query'=>[['key'=>'media_type','value'=>'video']],'no_found_rows'=>false]))->found_posts;
    $photos   = $total - $videos;
    $locs     = wp_count_terms( ['taxonomy'=>'asset_location'] );

    ob_start(); ?>
    <div class="ncm-stats">
        <div class="ncm-stat"><span class="ncm-stat__num"><?php echo $total; ?>+</span><span class="ncm-stat__label">Premium Assets</span></div>
        <div class="ncm-stat"><span class="ncm-stat__num"><?php echo $videos; ?>+</span><span class="ncm-stat__label">4K Videos</span></div>
        <div class="ncm-stat"><span class="ncm-stat__num"><?php echo $photos; ?>+</span><span class="ncm-stat__label">Hi-Res Photos</span></div>
        <div class="ncm-stat"><span class="ncm-stat__num"><?php echo max(9, $locs); ?>+</span><span class="ncm-stat__label">San Diego Locations</span></div>
    </div>
    <?php return ob_get_clean();
} );

// ── Features ──────────────────────────────────────────────────────────────────
add_shortcode( 'ncm_features', function() {
    $features = [
        [ 'icon' => 'M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z', 'title' => 'Cinematic 4K Footage', 'desc' => 'Every video shot on professional cinema cameras. Drone aerials, property walkthroughs, and lifestyle content.' ],
        [ 'icon' => 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z', 'title' => 'Hyper-Local San Diego', 'desc' => 'From La Jolla to Coronado, Gaslamp to Rancho Santa Fe. Content built specifically for San Diego real estate.' ],
        [ 'icon' => 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', 'title' => 'Instant Secure Download', 'desc' => 'Downloads go directly from our CDN to your computer. No waiting, no limits on file size.' ],
        [ 'icon' => 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', 'title' => 'Commercial License Included', 'desc' => 'Every asset includes a full commercial license for MLS listings, social media, ads, and print.' ],
        [ 'icon' => 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z', 'title' => 'New Content Monthly', 'desc' => 'Fresh aerials, seasonal content, and new neighborhoods added every month.' ],
        [ 'icon' => 'M13 10V3L4 14h7v7l9-11h-7z', 'title' => 'Sell Listings Faster', 'desc' => 'Listings with professional video get 403% more inquiries. Premium visuals are your competitive edge.' ],
    ];
    ob_start(); ?>
    <section class="ncm-features">
        <div class="ncm-features__grid">
            <?php foreach ( $features as $f ) : ?>
            <div class="ncm-feature-card">
                <div class="ncm-feature-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="<?php echo esc_attr( $f['icon'] ); ?>"/></svg>
                </div>
                <h3 class="ncm-feature-title"><?php echo esc_html( $f['title'] ); ?></h3>
                <p class="ncm-feature-desc"><?php echo esc_html( $f['desc'] ); ?></p>
            </div>
            <?php endforeach; ?>
        </div>
    </section>
    <?php return ob_get_clean();
} );

// ── Featured grid ─────────────────────────────────────────────────────────────
add_shortcode( 'ncm_featured_grid', function( $atts ) {
    $a = shortcode_atts( [ 'limit' => 6, 'title' => 'Featured Collection' ], $atts );
    $q = new WP_Query( [
        'post_type'      => 'stock_asset',
        'post_status'    => 'publish',
        'posts_per_page' => (int) $a['limit'],
        'meta_query'     => [ [ 'key' => 'featured', 'value' => '1' ] ],
        'no_found_rows'  => true,
    ] );
    if ( ! $q->have_posts() ) {
        // Fall back to most downloaded if no featured are set
        $q = new WP_Query( [ 'post_type' => 'stock_asset', 'post_status' => 'publish', 'posts_per_page' => (int) $a['limit'], 'meta_key' => 'download_count', 'orderby' => 'meta_value_num', 'order' => 'DESC', 'no_found_rows' => true ] );
    }
    ob_start(); ?>
    <section class="ncm-featured-section">
        <div class="ncm-section-header">
            <h2 class="ncm-section-title"><?php echo esc_html( $a['title'] ); ?></h2>
            <a href="/stock-library/" class="ncm-section-link">Browse all assets &rarr;</a>
        </div>
        <div class="ncm-asset-grid ncm-asset-grid--featured">
            <?php while ( $q->have_posts() ) { $q->the_post(); NCM_Library_Query::instance()->render_card_public( get_the_ID() ); } wp_reset_postdata(); ?>
        </div>
    </section>
    <?php return ob_get_clean();
} );