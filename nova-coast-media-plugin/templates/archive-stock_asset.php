<?php
defined( 'ABSPATH' ) || exit;
get_header();
$parent_locs = get_terms( [ 'taxonomy' => 'asset_location', 'hide_empty' => true, 'parent' => 0 ] ) ?: [];
$init_query  = new WP_Query( [ 'post_type' => 'stock_asset', 'post_status' => 'publish', 'posts_per_page' => 24 ] );
?>
<div class="ncm-library-wrap">
  <div class="ncm-library-hero">
    <h1>San Diego Luxury Media Library</h1>
    <p>Cinematic footage and photography built for real estate that sells.</p>
    <form class="ncm-search-form" action="" method="get">
      <input type="text" class="ncm-search-input" placeholder="Search La Jolla, aerial, luxury pool…" autocomplete="off">
      <svg class="ncm-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    </form>
  </div>
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
    <select class="ncm-filter-type" aria-label="Type"><option value="">Photos &amp; Videos</option><option value="photo">Photos Only</option><option value="video">Videos Only</option></select>
    <select class="ncm-filter-orientation" aria-label="Orientation"><option value="">All Orientations</option><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select>
    <button class="ncm-filter-clear">Clear</button>
  </div>
  <div class="ncm-asset-grid">
    <?php while ( $init_query->have_posts() ) { $init_query->the_post(); NCM_Library_Query::instance()->render_card_public( get_the_ID() ); } wp_reset_postdata(); ?>
  </div>
  <div class="ncm-load-more-wrap"><?php if ( $init_query->max_num_pages > 1 ) echo '<button class="ncm-load-more">Load More</button>'; ?></div>
</div>
<?php get_footer(); ?>
