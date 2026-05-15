<?php
defined( 'ABSPATH' ) || exit;

use Elementor\Widget_Base;
use Elementor\Controls_Manager;

class NCM_Widget_Asset_Library extends Widget_Base {

    public function get_name(): string        { return 'ncm_asset_library'; }
    public function get_title(): string       { return 'Stock Library'; }
    public function get_icon(): string        { return 'eicon-gallery-grid'; }
    public function get_categories(): array   { return [ 'nova-coast-media' ]; }
    public function get_keywords(): array     { return [ 'stock', 'library', 'video', 'photo', 'nova coast' ]; }

    protected function register_controls(): void {

        $this->start_controls_section( 'content_section', [
            'label' => 'Library Settings',
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $this->add_control( 'per_page', [
            'label'   => 'Assets per page',
            'type'    => Controls_Manager::NUMBER,
            'default' => 24,
            'min'     => 6,
            'max'     => 96,
        ] );

        $this->add_control( 'show_filters', [
            'label'        => 'Show Filters',
            'type'         => Controls_Manager::SWITCHER,
            'label_on'     => 'Yes',
            'label_off'    => 'No',
            'return_value' => 'yes',
            'default'      => 'yes',
        ] );

        $this->add_control( 'show_search', [
            'label'        => 'Show Search Bar',
            'type'         => Controls_Manager::SWITCHER,
            'label_on'     => 'Yes',
            'label_off'    => 'No',
            'return_value' => 'yes',
            'default'      => 'yes',
        ] );

        $this->add_control( 'columns', [
            'label'   => 'Grid Columns (desktop)',
            'type'    => Controls_Manager::SELECT,
            'options' => [ '2' => '2', '3' => '3', '4' => '4' ],
            'default' => '3',
        ] );

        $this->end_controls_section();
    }

    protected function render(): void {
        $s = $this->get_settings_for_display();

        $show_f = $s['show_filters'] === 'yes' ? 'true' : 'false';
        $show_s = $s['show_search']  === 'yes' ? 'true' : 'false';
        $cols   = (int) ( $s['columns'] ?? 3 );

        // Inline the column count as a CSS var
        echo '<style>.ncm-asset-grid{grid-template-columns:repeat(' . $cols . ',1fr)}</style>';

        echo do_shortcode(
            '[ncm_library per_page="' . (int) $s['per_page'] . '" '
            . 'show_filters="' . esc_attr( $show_f ) . '" '
            . 'show_search="'  . esc_attr( $show_s ) . '"]'
        );
    }
}
