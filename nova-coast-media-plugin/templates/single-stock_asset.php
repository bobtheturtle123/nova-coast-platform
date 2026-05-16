<?php
defined( 'ABSPATH' ) || exit;
get_header();
while ( have_posts() ) :
    the_post();
    $id          = get_the_ID();
    $r2          = NCM_R2_Storage::instance();
    $type        = get_field( 'media_type', $id );
    $preview_url = esc_url( $r2->get_public_url( get_field( 'preview_url', $id ) ?: '' ) );
    $thumb_url   = esc_url( $r2->get_public_url( get_field( 'thumbnail_url', $id ) ?: '' ) );
    $orient      = get_field( 'orientation', $id );
    $duration    = (int) get_field( 'duration', $id );
    $loc_terms   = get_the_terms( $id, 'asset_location' ) ?: [];
    usort( $loc_terms, fn($a,$b) => $a->parent <=> $b->parent );
    $loc_html = implode( ' &rsaquo; ', array_map( fn($t) => '<a href="'.esc_url(get_term_link($t)).'">' . esc_html($t->name) . '</a>', $loc_terms ) );
    $tags     = get_the_terms( $id, 'asset_tag' ) ?: [];
    $tags_html = implode( '', array_map( fn($t) => '<a href="'.esc_url(get_term_link($t)).'" class="ncm-tag">'.esc_html($t->name).'</a>', $tags ) );
    $label = $type === 'video' ? 'Download Full Video' : 'Download Full Photo';
?>
<div class="ncm-single-wrap">
  <div class="ncm-single-media ncm-single-media--<?php echo esc_attr($orient); ?>">
    <?php if ( $type === 'video' && $preview_url ) : ?>
      <video src="<?php echo $preview_url; ?>" autoplay muted loop playsinline poster="<?php echo $thumb_url; ?>"></video>
    <?php elseif ( $thumb_url ) : ?>
      <img src="<?php echo $thumb_url; ?>" alt="<?php the_title_attribute(); ?>">
    <?php endif; ?>
  </div>
  <div class="ncm-single-meta">
    <div>
      <h1 class="ncm-single-title"><?php the_title(); ?></h1>
      <?php if ( $loc_html ) echo '<p class="ncm-single-location">' . $loc_html . '</p>'; ?>
      <?php if ( $type === 'video' && $duration ) echo '<p class="ncm-single-location">Duration: ' . gmdate('i:s',$duration) . '</p>'; ?>
      <?php if ( $tags_html ) echo '<div class="ncm-single-tags">' . $tags_html . '</div>'; ?>
    </div>
    <div class="ncm-single-download-panel">
      <p style="color:#aaa;font-size:.8125rem;text-transform:uppercase;letter-spacing:.08em;margin:0 0 14px"><?php echo $type === 'video' ? '4K Footage' : 'Hi-Res Photo'; ?></p>
      <?php if ( is_user_logged_in() ) : ?>
        <button class="ncm-download-btn" data-asset-id="<?php echo $id; ?>" data-original-text="<?php echo esc_attr($label); ?>"><?php echo $label; ?></button>
        <p class="ncm-credits-display">Loading...</p>
      <?php else : ?>
        <a href="<?php echo esc_url(wp_login_url(get_permalink())); ?>" class="ncm-download-btn" style="display:block;text-align:center;text-decoration:none;">Sign In to Download</a>
        <p class="ncm-credits-display"><a href="<?php echo esc_url( function_exists('wc_get_page_permalink') ? wc_get_page_permalink('shop') : '/shop' ); ?>" style="color:var(--ncm-gold);text-decoration:none;">View plans &rarr;</a></p>
      <?php endif; ?>
    </div>
  </div>
  <?php the_content(); ?>
</div>
<?php endwhile; get_footer(); ?>
