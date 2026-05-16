<?php
defined( 'ABSPATH' ) || exit;

class NCM_Taxonomy_Setup {
    private static ?self $instance = null;
    public static function instance(): self {
        if ( null === self::$instance ) self::$instance = new self();
        return self::$instance;
    }
    public function init(): void {
        add_action( 'init', [ $this, 'register_taxonomies' ] );
        add_action( 'init', [ $this, 'seed_locations' ], 20 );
    }
    public function register_taxonomies(): void {
        register_taxonomy( 'asset_tag', 'stock_asset', [
            'labels'            => [ 'name' => 'Asset Tags', 'singular_name' => 'Asset Tag' ],
            'hierarchical'      => false,
            'public'            => true,
            'show_ui'           => true,
            'show_in_rest'      => true,
            'show_admin_column' => true,
            'rewrite'           => [ 'slug' => 'asset-tag', 'with_front' => false ],
        ] );
        register_taxonomy( 'asset_location', 'stock_asset', [
            'labels'            => [ 'name' => 'Locations', 'singular_name' => 'Location', 'parent_item' => 'Parent Location' ],
            'hierarchical'      => true,
            'public'            => true,
            'show_ui'           => true,
            'show_in_rest'      => true,
            'show_admin_column' => true,
            'rewrite'           => [ 'slug' => 'location', 'with_front' => false ],
        ] );
    }
    public function seed_locations(): void {
        if ( get_option( 'ncm_locations_seeded' ) ) return;
        $tree = [
            'San Diego' => [
                'Downtown San Diego' => [ 'Gaslamp', 'Little Italy', 'East Village' ],
                'La Jolla' => [], 'Del Mar' => [], 'Coronado' => [],
                'Rancho Santa Fe' => [], 'Pacific Beach' => [],
                'Mission Beach' => [], 'Encinitas' => [],
            ],
        ];
        foreach ( $tree as $parent_name => $children ) {
            $parent = $this->get_or_create( $parent_name, 0 );
            foreach ( $children as $child_name => $grandchildren ) {
                $child = $this->get_or_create( $child_name, $parent );
                foreach ( $grandchildren as $g ) {
                    $this->get_or_create( $g, $child );
                }
            }
        }
        update_option( 'ncm_locations_seeded', true );
    }
    private function get_or_create( string $name, int $parent ): int {
        $t = get_term_by( 'name', $name, 'asset_location' );
        if ( $t ) return (int) $t->term_id;
        $r = wp_insert_term( $name, 'asset_location', [ 'parent' => $parent ] );
        return is_wp_error( $r ) ? 0 : (int) $r['term_id'];
    }
}
