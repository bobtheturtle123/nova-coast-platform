<?php
defined( 'ABSPATH' ) || exit;

/**
 * Registers Nova Coast Media widgets inside Elementor.
 * Appears under "Nova Coast Media" category in the Elementor panel.
 */
class NCM_Elementor_Widgets {

    private static ?self $instance = null;

    public static function instance(): self {
        if ( null === self::$instance ) self::$instance = new self();
        return self::$instance;
    }

    public function init(): void {
        add_action( 'elementor/widgets/register', [ $this, 'register_widgets' ] );
        add_action( 'elementor/elements/categories_registered', [ $this, 'register_category' ] );
    }

    public function register_category( $manager ): void {
        $manager->add_category( 'nova-coast-media', [
            'title' => 'Nova Coast Media',
            'icon'  => 'eicon-video-camera',
        ] );
    }

    public function register_widgets( $manager ): void {
        require_once NCM_PLUGIN_DIR . 'includes/elementor/widget-asset-library.php';
        require_once NCM_PLUGIN_DIR . 'includes/elementor/widget-download-button.php';
        require_once NCM_PLUGIN_DIR . 'includes/elementor/widget-user-credits.php';

        $manager->register( new NCM_Widget_Asset_Library() );
        $manager->register( new NCM_Widget_Download_Button() );
        $manager->register( new NCM_Widget_User_Credits() );
    }
}
