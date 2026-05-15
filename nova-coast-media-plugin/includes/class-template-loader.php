<?php
defined( 'ABSPATH' ) || exit;

/**
 * Automatically loads plugin templates for stock_asset CPT.
 * Zero theme modification required — works with any theme including Elementor ones.
 */
class NCM_Template_Loader {

    private static ?self $instance = null;

    public static function instance(): self {
        if ( null === self::$instance ) self::$instance = new self();
        return self::$instance;
    }

    public function init(): void {
        add_filter( 'template_include', [ $this, 'load_templates' ], 99 );
    }

    public function load_templates( string $template ): string {
        // Single stock asset
        if ( is_singular( 'stock_asset' ) ) {
            $plugin_template = NCM_PLUGIN_DIR . 'templates/single-stock_asset.php';
            if ( file_exists( $plugin_template ) ) return $plugin_template;
        }

        // Archive / stock library
        if ( is_post_type_archive( 'stock_asset' ) ) {
            $plugin_template = NCM_PLUGIN_DIR . 'templates/archive-stock_asset.php';
            if ( file_exists( $plugin_template ) ) return $plugin_template;
        }

        return $template;
    }
}
