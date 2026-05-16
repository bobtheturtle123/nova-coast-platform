<?php
defined( 'ABSPATH' ) || exit;

class NCM_CPT_Registration {
    private static ?self $instance = null;
    public static function instance(): self {
        if ( null === self::$instance ) self::$instance = new self();
        return self::$instance;
    }
    public function init(): void {
        add_action( 'init', [ $this, 'register' ] );
    }
    public function register(): void {
        register_post_type( 'stock_asset', [
            'labels' => [
                'name'          => 'Stock Assets',
                'singular_name' => 'Stock Asset',
                'menu_name'     => 'Stock Assets',
                'add_new'       => 'Add Asset',
                'add_new_item'  => 'Add New Asset',
                'edit_item'     => 'Edit Asset',
                'view_item'     => 'View Asset',
                'search_items'  => 'Search Assets',
                'not_found'     => 'No assets found',
            ],
            'public'             => true,
            'publicly_queryable' => true,
            'show_ui'            => true,
            'show_in_menu'       => true,
            'show_in_rest'       => true,
            'query_var'          => true,
            'rewrite'            => [ 'slug' => 'stock', 'with_front' => false ],
            'capability_type'    => 'post',
            'has_archive'        => 'stock-library',
            'hierarchical'       => false,
            'menu_position'      => 5,
            'menu_icon'          => 'dashicons-format-video',
            'supports'           => [ 'title', 'editor', 'thumbnail', 'custom-fields', 'excerpt' ],
            'taxonomies'         => [ 'asset_tag', 'asset_location' ],
        ] );
    }
}
