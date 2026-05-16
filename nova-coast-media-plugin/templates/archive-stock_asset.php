<?php
defined( 'ABSPATH' ) || exit;
get_header();
$parent_locs = get_terms( [ 'taxonomy' => 'asset_location', 'hide_empty' => true, 'parent' => 0 ] ) ?: [];
$init_query  = new WP_Query( [ 'post_type' => 'stock_asset', 'post_status' => 'publish', 'posts_per_page' => 24 ] );
$total_assets = wp_count_posts('stock_asset')->publish;
?>

<div class="ncm-archive-page">

    <!-- Library hero header -->
    <div class="ncm-archive-hero">
        <div class="ncm-archive-hero__inner">
            <p class="ncm-archive-eyebrow">San Diego Real Estate Media</p>
            <h1 class="ncm-archive-title">Stock Library</h1>
            <p class="ncm-archive-sub"><?php echo $total_assets; ?> premium assets. Aerial footage, interiors, lifestyle, and more.</p>
            <form class="ncm-search-form" action="" method="get">
                <svg class="ncm-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" class="ncm-search-input" placeholder="Search La Jolla, aerial, sunset..." autocomplete="off">
            </form>
        </div>
    </div>

    <div class="ncm-archive-body">

        <!-- Sidebar filters -->
        <aside class="ncm-archive-sidebar">
            <div class="ncm-sidebar-section">
                <h3 class="ncm-sidebar-title">Media Type</h3>
                <label class="ncm-sidebar-option"><input type="radio" name="filter_type" class="ncm-filter-type" value=""> All</label>
                <label class="ncm-sidebar-option"><input type="radio" name="filter_type" class="ncm-filter-type" value="video"> Videos</label>
                <label class="ncm-sidebar-option"><input type="radio" name="filter_type" class="ncm-filter-type" value="photo"> Photos</label>
            </div>

            <div class="ncm-sidebar-section">
                <h3 class="ncm-sidebar-title">Orientation</h3>
                <label class="ncm-sidebar-option"><input type="radio" name="filter_orient" class="ncm-filter-orientation" value=""> All</label>
                <label class="ncm-sidebar-option"><input type="radio" name="filter_orient" class="ncm-filter-orientation" value="horizontal"> Horizontal</label>
                <label class="ncm-sidebar-option"><input type="radio" name="filter_orient" class="ncm-filter-orientation" value="vertical"> Vertical</label>
            </div>

            <div class="ncm-sidebar-section">
                <h3 class="ncm-sidebar-title">Location</h3>
                <label class="ncm-sidebar-option"><input type="radio" name="filter_loc" class="ncm-filter-location" value=""> All Locations</label>
                <?php foreach ( $parent_locs as $loc ) : ?>
                    <label class="ncm-sidebar-option ncm-sidebar-option--parent">
                        <input type="radio" name="filter_loc" class="ncm-filter-location" value="<?php echo esc_attr($loc->slug); ?>">
                        <?php echo esc_html($loc->name); ?>
                    </label>
                    <?php foreach ( get_terms(['taxonomy'=>'asset_location','parent'=>$loc->term_id,'hide_empty'=>true]) ?: [] as $child ) : ?>
                        <label class="ncm-sidebar-option ncm-sidebar-option--child">
                            <input type="radio" name="filter_loc" class="ncm-filter-location" value="<?php echo esc_attr($child->slug); ?>">
                            <?php echo esc_html($child->name); ?>
                        </label>
                    <?php endforeach; ?>
                <?php endforeach; ?>
            </div>

            <button class="ncm-filter-clear ncm-sidebar-clear">Clear all filters</button>
        </aside>

        <!-- Main grid -->
        <div class="ncm-archive-main">
            <div class="ncm-archive-toolbar">
                <span class="ncm-filter-count"><?php echo $total_assets; ?> assets</span>
                <div class="ncm-toolbar-right">
                    <?php if ( is_user_logged_in() ) : ?>
                        <span class="ncm-credits-display ncm-toolbar-credits"></span>
                    <?php else : ?>
                        <a href="<?php echo esc_url(wp_login_url()); ?>" class="ncm-toolbar-signin">Sign in to download</a>
                    <?php endif; ?>
                </div>
            </div>

            <div class="ncm-asset-grid">
                <?php while ( $init_query->have_posts() ) { $init_query->the_post(); NCM_Library_Query::instance()->render_card_public( get_the_ID() ); } wp_reset_postdata(); ?>
            </div>

            <div class="ncm-load-more-wrap">
                <?php if ( $init_query->max_num_pages > 1 ) : ?>
                    <button class="ncm-load-more">Load More Assets</button>
                <?php endif; ?>
            </div>
        </div>
    </div>
</div>
<?php get_footer(); ?>