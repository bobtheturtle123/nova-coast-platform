<?php
defined( 'ABSPATH' ) || exit;

use Elementor\Widget_Base;
use Elementor\Controls_Manager;

class NCM_Widget_User_Credits extends Widget_Base {

    public function get_name(): string        { return 'ncm_user_credits'; }
    public function get_title(): string       { return 'User Credits Badge'; }
    public function get_icon(): string        { return 'eicon-counter'; }
    public function get_categories(): array   { return [ 'nova-coast-media' ]; }
    public function get_keywords(): array     { return [ 'credits', 'downloads', 'plan', 'nova coast' ]; }

    protected function register_controls(): void {
        $this->start_controls_section( 'content_section', [
            'label' => 'Credits Display',
            'tab'   => Controls_Manager::TAB_CONTENT,
        ] );

        $this->add_control( 'info', [
            'label'     => 'Note',
            'type'      => Controls_Manager::RAW_HTML,
            'raw'       => 'Shows the logged-in user\'s remaining downloads and plan name. Hidden for guests.',
            'separator' => 'before',
        ] );

        $this->end_controls_section();
    }

    protected function render(): void {
        echo do_shortcode( '[ncm_user_credits]' );
    }
}
