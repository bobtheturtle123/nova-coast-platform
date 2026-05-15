<?php
defined( 'ABSPATH' ) || exit;

class NCM_SEO_Automation {
    private static ?self $instance = null;
    public static function instance(): self {
        if ( null === self::$instance ) self::$instance = new self();
        return self::$instance;
    }
    public function init(): void {
        add_filter( 'wpseo_title',           [ $this, 'filter_title' ] );
        add_filter( 'wpseo_metadesc',        [ $this, 'filter_desc' ] );
        add_filter( 'rank_math/title',       [ $this, 'filter_title' ] );
        add_filter( 'rank_math/description', [ $this, 'filter_desc' ] );
        add_action( 'wp_head',              [ $this, 'fallback_meta' ], 1 );
        add_filter( 'the_content',           [ $this, 'append_related' ] );
    }
    public function filter_title( string $t ): string {
        return is_singular( 'stock_asset' ) ? $this->build_title( get_the_ID() ) : $t;
    }
    public function filter_desc( string $d ): string {
        return is_singular( 'stock_asset' ) ? $this->build_desc( get_the_ID() ) : $d;
    }
    public function fallback_meta(): void {
        if ( ! is_singular( 'stock_asset' ) || defined( 'WPSEO_VERSION' ) || class_exists( 'RankMath' ) ) return;
        $id    = get_the_ID();
        $title = esc_attr( $this->build_title( $id ) );
        $desc  = esc_attr( $this->build_desc( $id ) );
        echo "<title>{$title}</title>\n<meta name=\"description\" content=\"{$desc}\">\n";
        $thumb = get_field( 'thumbnail_url', $id );
        if ( $thumb ) echo '<meta property="og:image" content="' . esc_url( NCM_R2_Storage::instance()->get_public_url( $thumb ) ) . "\">\n";
    }
    public function append_related( string $content ): string {
        if ( ! is_singular( 'stock_asset' ) || ! in_the_loop() ) return $content;
        $ids = $this->related_ids( get_the_ID() );
        if ( empty( $ids ) ) return $content;
        $r2   = NCM_R2_Storage::instance();
        $html = '<div class="ncm-related-assets"><h3 class="ncm-related-title">More from this location</h3><div class="ncm-related-grid">';
        foreach ( $ids as $rid ) {
            $thumb = get_field( 'thumbnail_url', $rid );
            $turl  = $thumb ? esc_url( $r2->get_public_url( $thumb ) ) : '';
            $link  = esc_url( get_permalink( $rid ) );
            $name  = esc_html( get_the_title( $rid ) );
            $html .= "<a href=\"{$link}\" class=\"ncm-related-item\">" . ( $turl ? "<img src=\"{$turl}\" alt=\"{$name}\" loading=\"lazy\">" : '' ) . "<span>{$name}</span></a>";
        }
        $html .= '</div></div>';
        return $content . $html;
    }
    private function build_title( int $id ): string {
        $loc  = $this->primary_location( $id );
        $type = get_field( 'media_type', $id ) === 'video' ? 'Stock Footage' : 'Stock Photo';
        return ( $loc ? "{$loc} " : '' ) . get_the_title( $id ) . " | San Diego {$type}";
    }
    private function build_desc( int $id ): string {
        $loc  = $this->primary_location( $id );
        $type = get_field( 'media_type', $id ) === 'video' ? 'cinematic footage' : 'professional photography';
        $at   = $loc ? " in {$loc}, San Diego" : ' in San Diego';
        return "Premium {$type} of " . get_the_title( $id ) . "{$at}. Ideal for luxury real estate marketing and MLS listings.";
    }
    private function primary_location( int $id ): string {
        $terms = get_the_terms( $id, 'asset_location' );
        if ( ! $terms || is_wp_error( $terms ) ) return '';
        usort( $terms, fn( $a, $b ) => $b->parent <=> $a->parent );
        return $terms[0]->name;
    }
    private function related_ids( int $id ): array {
        $term_ids = wp_get_post_terms( $id, 'asset_location', [ 'fields' => 'ids' ] );
        if ( empty( $term_ids ) ) return [];
        $q = new WP_Query( [ 'post_type' => 'stock_asset', 'post_status' => 'publish', 'posts_per_page' => 6, 'post__not_in' => [ $id ], 'tax_query' => [ [ 'taxonomy' => 'asset_location', 'field' => 'term_id', 'terms' => $term_ids ] ], 'no_found_rows' => true ] );
        return $q->posts ? wp_list_pluck( $q->posts, 'ID' ) : [];
    }
}
