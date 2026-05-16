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
    $orient      = get_field( 'orientation', $id ) ?: 'horizontal';
    $duration    = (int) get_field( 'duration', $id );
    $loc_terms   = get_the_terms( $id, 'asset_location' ) ?: [];
    usort( $loc_terms, fn($a,$b) => $a->parent <=> $b->parent );
    $loc_parts  = array_map( fn($t) => '<a href="'.esc_url(get_term_link($t)).'" class="ncm-breadcrumb-link">'.esc_html($t->name).'</a>', $loc_terms );
    $loc_html   = implode( '<span class="ncm-breadcrumb-sep">/</span>', $loc_parts );
    $tags       = get_the_terms( $id, 'asset_tag' ) ?: [];
    $label      = $type === 'video' ? 'Download Full Video' : 'Download Full Photo';
    $media_label = $type === 'video' ? '4K Video' : 'Hi-Res Photo';
?>
<div class="ncm-single-page">

    <!-- Full-width media -->
    <div class="ncm-single-hero ncm-single-hero--<?php echo esc_attr($orient); ?>">
        <?php if ( $type === 'video' && $preview_url ) : ?>
            <video class="ncm-single-hero__media" src="<?php echo $preview_url; ?>" autoplay muted loop playsinline poster="<?php echo $thumb_url; ?>"></video>
            <div class="ncm-single-hero__badge ncm-single-hero__badge--video">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                4K Video<?php echo $duration ? ' &mdash; ' . gmdate('i:s', $duration) : ''; ?>
            </div>
        <?php elseif ( $thumb_url ) : ?>
            <img class="ncm-single-hero__media" src="<?php echo $thumb_url; ?>" alt="<?php the_title_attribute(); ?>">
            <div class="ncm-single-hero__badge">Hi-Res Photo</div>
        <?php endif; ?>
        <div class="ncm-single-hero__gradient"></div>
    </div>

    <!-- Content -->
    <div class="ncm-single-body">
        <div class="ncm-single-main">

            <!-- Breadcrumb -->
            <?php if ( $loc_html ) : ?>
            <nav class="ncm-breadcrumb">
                <a href="/stock-library/" class="ncm-breadcrumb-link">Library</a>
                <span class="ncm-breadcrumb-sep">/</span>
                <?php echo $loc_html; ?>
            </nav>
            <?php endif; ?>

            <h1 class="ncm-single-title"><?php the_title(); ?></h1>

            <!-- Tags -->
            <?php if ( $tags ) : ?>
            <div class="ncm-single-tags">
                <?php foreach ( $tags as $tag ) : ?>
                    <a href="<?php echo esc_url(get_term_link($tag)); ?>" class="ncm-tag"><?php echo esc_html($tag->name); ?></a>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>

            <!-- Description -->
            <?php if ( get_the_content() ) : ?>
            <div class="ncm-single-description"><?php the_content(); ?></div>
            <?php endif; ?>

            <!-- Details grid -->
            <div class="ncm-single-details">
                <div class="ncm-detail"><span class="ncm-detail__label">Type</span><span class="ncm-detail__value"><?php echo esc_html( $media_label ); ?></span></div>
                <div class="ncm-detail"><span class="ncm-detail__label">Orientation</span><span class="ncm-detail__value"><?php echo esc_html( ucfirst( $orient ) ); ?></span></div>
                <?php if ( $type === 'video' && $duration ) : ?>
                <div class="ncm-detail"><span class="ncm-detail__label">Duration</span><span class="ncm-detail__value"><?php echo gmdate('i:s', $duration); ?></span></div>
                <?php endif; ?>
                <?php if ( $loc_terms ) : ?>
                <div class="ncm-detail"><span class="ncm-detail__label">Location</span><span class="ncm-detail__value"><?php echo esc_html( end($loc_terms)->name ); ?></span></div>
                <?php endif; ?>
            </div>
        </div>

        <!-- Download panel -->
        <aside class="ncm-single-panel">
            <div class="ncm-panel-inner">
                <p class="ncm-panel-type"><?php echo esc_html( $media_label ); ?></p>
                <p class="ncm-panel-title"><?php the_title(); ?></p>

                <?php if ( is_user_logged_in() ) : ?>
                    <button class="ncm-download-btn ncm-download-btn--lg"
                            data-asset-id="<?php echo $id; ?>"
                            data-original-text="<?php echo esc_attr($label); ?>">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                        <?php echo esc_html($label); ?>
                    </button>
                    <p class="ncm-credits-display">Loading...</p>
                <?php else : ?>
                    <a href="<?php echo esc_url(wp_login_url(get_permalink())); ?>" class="ncm-download-btn ncm-download-btn--lg">
                        Sign In to Download
                    </a>
                    <p class="ncm-panel-note">Need an account? <a href="<?php echo esc_url(wp_registration_url()); ?>" class="ncm-link-gold">Sign up free</a></p>
                <?php endif; ?>

                <div class="ncm-panel-features">
                    <div class="ncm-panel-feature"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Commercial license</div>
                    <div class="ncm-panel-feature"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> Instant download</div>
                    <div class="ncm-panel-feature"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg> Secure &amp; private</div>
                </div>

                <div class="ncm-panel-upgrade">
                    <p>No subscription?</p>
                    <a href="#ncm-plans" class="ncm-link-gold">View plans &rarr;</a>
                </div>
            </div>
        </aside>
    </div>

    <!-- Related assets (appended by SEO class) -->
    <?php the_content(); ?>

</div>
<?php endwhile; get_footer(); ?>