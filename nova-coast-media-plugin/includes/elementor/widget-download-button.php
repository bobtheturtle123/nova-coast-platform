<?php
defined( 'ABSPATH' ) || exit;

use Elementor\Widget_Base;
use Elementor\Controls_Manager;

class NCM_Widget_Download_Button extends Widget_Base {

    public function get_name(): string        { return 'ncm_download_button'; }
    public function get_title(): string       { return 'Download Button'; }
    public function get_icon(): string        { return 'eicon-download-button'; }
    public function get_categories(): array   { return [ 'nova-coast-media' ]; }
    public function get_keywords(): array     { return [ 'download', 'button', 'nova coast', 'asset' ]; }

    protected function register_controls(): void {

        $this->start_controls_section( 'content_section', [
            'label' => 'Button Settings',
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $this->add_control( 'asset_id', [
            'label'       => 'Asset Post ID',
            'type'        => Controls_Manager::NUMBER,
            'description' => 'The WordPress post ID of the stock_asset. Find it in Stock Assets list.',
            'default'     => 0,
        ] );

        $this->add_control( 'label', [
            'label'   => 'Button Label (optional)',
            'type'    => Controls_Manager::TEXT,
            'default' => '',
            'placeholder' => 'Download Full Video',
        ] );

        $this->end_controls_section();
    }

    protected function render(): void {
        $s = $this->get_settings_for_display();
        echo do_shortcode(
            '[ncm_download_button id="' . (int) $s['asset_id'] . '" label="' . esc_attr( $s['label'] ) . '"]'
        );
    }
}
