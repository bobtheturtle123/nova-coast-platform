<?php
/**
 * Plugin Name: Nova Coast Media
 * Plugin URI:  https://novacoastmedia.com
 * Description: Premium stock photography and video platform for luxury real estate media.
 * Version:     1.0.0
 * Author:      Nova Coast Media
 * License:     Proprietary
 * Text Domain: nova-coast-media
 *
 * Requires: Advanced Custom Fields, Elementor (optional)
 * No WooCommerce dependency — billing handled directly via Stripe.
 */

defined( 'ABSPATH' ) || exit;

define( 'NCM_VERSION',     '1.0.0' );
define( 'NCM_PLUGIN_FILE', __FILE__ );
define( 'NCM_PLUGIN_DIR',  plugin_dir_path( __FILE__ ) );
define( 'NCM_PLUGIN_URL',  plugin_dir_url( __FILE__ ) );

spl_autoload_register( function ( $class ) {
    $map = [
        'NCM_CPT_Registration'       => 'includes/class-cpt-registration.php',
        'NCM_ACF_Fields'             => 'includes/class-acf-fields.php',
        'NCM_Taxonomy_Setup'         => 'includes/class-taxonomy-setup.php',
        'NCM_Stripe_Handler'         => 'includes/class-stripe-handler.php',
        'NCM_Subscription_Validator' => 'includes/class-subscription-validator.php',
        'NCM_Credit_System'          => 'includes/class-credit-system.php',
        'NCM_R2_Storage'             => 'includes/class-r2-storage.php',
        'NCM_Download_Handler'       => 'includes/class-download-handler.php',
        'NCM_CSV_Importer'           => 'includes/class-csv-importer.php',
        'NCM_SEO_Automation'         => 'includes/class-seo-automation.php',
        'NCM_Library_Query'          => 'includes/class-library-query.php',
        'NCM_Template_Loader'        => 'includes/class-template-loader.php',
        'NCM_Shortcodes'             => 'includes/class-shortcodes.php',
        'NCM_Elementor_Widgets'      => 'includes/class-elementor-widgets.php',
        'NCM_Admin_Interface'        => 'admin/class-admin-interface.php',
    ];
    if ( isset( $map[ $class ] ) ) {
        require_once NCM_PLUGIN_DIR . $map[ $class ];
    }
} );

final class Nova_Coast_Media {

    private static ?self $instance = null;

    public static function instance(): self {
        if ( null === self::$instance ) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {
        add_action( 'plugins_loaded', [ $this, 'init' ] );
        register_activation_hook( NCM_PLUGIN_FILE,   [ $this, 'activate' ] );
        register_deactivation_hook( NCM_PLUGIN_FILE, [ $this, 'deactivate' ] );
    }

    public function init(): void {
        // Content
        NCM_CPT_Registration::instance()->init();
        NCM_Taxonomy_Setup::instance()->init();
        NCM_ACF_Fields::instance()->init();

        // Billing + access
        NCM_Stripe_Handler::instance()->init();
        NCM_Subscription_Validator::instance()->init();
        NCM_Credit_System::instance()->init();

        // Downloads + library
        NCM_Download_Handler::instance()->init();
        NCM_Library_Query::instance()->init();

        // Templates + shortcodes
        NCM_Template_Loader::instance()->init();
        NCM_Shortcodes::instance()->init();
        NCM_SEO_Automation::instance()->init();

        // Elementor widgets (only if Elementor is active)
        add_action( 'elementor/widgets/register', function( $mgr ) {
            NCM_Elementor_Widgets::instance()->init();
        } );

        // Admin
        if ( is_admin() ) {
            NCM_Admin_Interface::instance()->init();
            NCM_CSV_Importer::instance()->init();
        }

        add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_assets' ] );
    }

    public function enqueue_assets(): void {
        wp_enqueue_style(
            'ncm-frontend',
            NCM_PLUGIN_URL . 'assets/css/ncm-frontend.css',
            [],
            NCM_VERSION
        );

        wp_enqueue_script(
            'ncm-library',
            NCM_PLUGIN_URL . 'assets/js/ncm-library.js',
            [ 'jquery' ],
            NCM_VERSION,
            true
        );

        wp_enqueue_script(
            'ncm-download',
            NCM_PLUGIN_URL . 'assets/js/ncm-download.js',
            [ 'jquery' ],
            NCM_VERSION,
            true
        );

        // Pass config to JS
        $opts = get_option( 'ncm_stripe_settings', [] );
        wp_localize_script( 'ncm-download', 'NCM', [
            'ajax_url'    => admin_url( 'admin-ajax.php' ),
            'nonce'       => wp_create_nonce( 'ncm_download_nonce' ),
            'stripe_nonce'=> wp_create_nonce( 'ncm_stripe_nonce' ),
            'is_logged_in'=> is_user_logged_in(),
            'login_url'   => wp_login_url( get_permalink() ),
            'plans_url'   => home_url( '/#ncm-plans' ),
        ] );

        wp_localize_script( 'ncm-library', 'NCM_Library', [
            'ajax_url' => admin_url( 'admin-ajax.php' ),
            'nonce'    => wp_create_nonce( 'ncm_library_nonce' ),
        ] );
    }

    public function activate(): void {
        NCM_CPT_Registration::instance()->init();
        NCM_Taxonomy_Setup::instance()->init();
        flush_rewrite_rules();

        global $wpdb;
        $charset = $wpdb->get_charset_collate();
        $sql = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}ncm_downloads (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            asset_id BIGINT UNSIGNED NOT NULL,
            downloaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY user_id (user_id),
            KEY asset_id (asset_id)
        ) $charset;";
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta( $sql );
    }

    public function deactivate(): void {
        flush_rewrite_rules();
    }
}

Nova_Coast_Media::instance();
