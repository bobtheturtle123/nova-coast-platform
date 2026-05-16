<?php
defined( 'ABSPATH' ) || exit;

class NCM_Library_Query {
    private static ?self $instance = null;
    public static function instance(): self {
        if ( null === self::$instance ) self::$instance = new self();
        return self::$instance;
    }
    public function init(): void {
        add_action( 'wp_ajax_ncm_filter_assets',        [ $this, 'handle_filter' ] );
        add_action( 'wp_ajax_nopriv_ncm_filter_assets', [ $this, 'handle_filter' ] );
    }
    public function handle_filter(): void {
        check_ajax_referer( 'ncm_library_nonce', 'nonce' );
        $location    = sanitize_text_field( $_POST['location']    ?? '' );
        $media_type  = sanitize_text_field( $_POST['media_type']  ?? '' );
        $orientation = sanitize_text_field( $_POST['orientation'] ?? '' );
        $search      = sanitize_text_field( $_POST['search']      ?? '' );
        $page        = max( 1, (int) ( $_POST['page'] ?? 1 ) );

        $args = [ 'post_type' => 'stock_asset', 'post_status' => 'publish', 'posts_per_page' => 24, 'paged' => $page ];
        if ( $search ) $args['s'] = $search;
        if ( in_array( $media_type, [ 'photo', 'video' ], true ) )
            $args['meta_query'][] = [ 'key' => 'media_type', 'value' => $media_type ];
        if ( in_array( $orientation, [ 'horizontal', 'vertical' ], true ) )
            $args['meta_query'][] = [ 'key' => 'orientation', 'value' => $orientation ];
        if ( $location ) {
            $term = get_term_by( 'slug', $location, 'asset_location' ) ?: get_term_by( 'name', $location, 'asset_location' );
            if ( $term ) {
                $ids = array_merge( [ $term->term_id ], (array) get_term_children( $term->term_id, 'asset_location' ) );
                $args['tax_query'][] = [ 'taxonomy' => 'asset_location', 'field' => 'term_id', 'terms' => $ids ];
            }
        }

        $q = new WP_Query( $args );
        ob_start();
        while ( $q->have_posts() ) { $q->the_post(); $this->render_card( get_the_ID() ); }
        wp_reset_postdata();
        $html = ob_get_clean();

        wp_send_json_success( [ 'html' => $html, 'has_more' => $page < $q->max_num_pages, 'total' => (int) $q->found_posts ] );
    }

    public function render_card_public( int $post_id ): void { $this->render_card( $post_id ); }

    private function render_card( int $post_id ): void {
        $r2          = NCM_R2_Storage::instance();
        $type        = get_field( 'media_type', $post_id );
        $thumb_url   = esc_url( $r2->get_public_url( get_field( 'thumbnail_url', $post_id ) ?: '' ) );
        $preview_url = esc_url( $r2->get_public_url( get_field( 'preview_url',   $post_id ) ?: '' ) );
        $permalink   = esc_url( get_permalink( $post_id ) );
        $title       = esc_html( get_the_title( $post_id ) );
        $orient      = esc_attr( get_field( 'orientation', $post_id ) );
        $duration    = (int) get_field( 'duration', $post_id );

        $terms = get_the_terms( $post_id, 'asset_location' );
        $loc   = '';
        if ( $terms && ! is_wp_error( $terms ) ) {
            usort( $terms, fn( $a, $b ) => $b->parent <=> $a->parent );
            $loc = esc_html( $terms[0]->name );
        }

        $dur_html  = ( $type === 'video' && $duration ) ? '<span class="ncm-card-duration">' . gmdate( 'i:s', $duration ) . '</span>' : '';
        $type_badge = $type === 'video' ? '<span class="ncm-card-badge ncm-card-badge--video">Video</span>' : '';

        echo <<<HTML
<article class="ncm-asset-card ncm-asset-card--{$orient}" data-type="{$type}" data-preview="{$preview_url}">
  <a href="{$permalink}" class="ncm-card-link">
    <div class="ncm-card-media">
      <img class="ncm-thumb" src="{$thumb_url}" alt="{$title}" loading="lazy">
      {$dur_html}{$type_badge}
    </div>
    <div class="ncm-card-info">
      <h3 class="ncm-card-title">{$title}</h3>
      <span class="ncm-card-location">{$loc}</span>
    </div>
  </a>
  <button class="ncm-download-btn" data-asset-id="{$post_id}" data-original-text="Download">Download</button>
</article>
HTML;
    }
}
