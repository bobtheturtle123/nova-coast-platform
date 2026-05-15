<?php
defined( 'ABSPATH' ) || exit;

class NCM_ACF_Fields {
    private static ?self $instance = null;
    public static function instance(): self {
        if ( null === self::$instance ) self::$instance = new self();
        return self::$instance;
    }
    public function init(): void {
        add_action( 'acf/init', [ $this, 'register_fields' ] );
    }
    public function register_fields(): void {
        if ( ! function_exists( 'acf_add_local_field_group' ) ) return;
        acf_add_local_field_group( [
            'key'    => 'group_ncm_asset_details',
            'title'  => 'Asset Details',
            'fields' => [
                [ 'key' => 'field_ncm_media_type',    'label' => 'Media Type',    'name' => 'media_type',    'type' => 'select', 'choices' => [ 'photo' => 'Photo', 'video' => 'Video' ], 'default_value' => 'photo', 'required' => 1 ],
                [ 'key' => 'field_ncm_orientation',   'label' => 'Orientation',   'name' => 'orientation',   'type' => 'select', 'choices' => [ 'horizontal' => 'Horizontal', 'vertical' => 'Vertical' ], 'default_value' => 'horizontal', 'required' => 1 ],
                [ 'key' => 'field_ncm_thumbnail_url', 'label' => 'Thumbnail URL (R2 key)', 'name' => 'thumbnail_url', 'type' => 'text', 'required' => 1 ],
                [ 'key' => 'field_ncm_preview_url',   'label' => 'Preview URL (R2 key)',   'name' => 'preview_url',   'type' => 'text', 'required' => 1 ],
                [ 'key' => 'field_ncm_full_res_url',  'label' => 'Full-Res URL (R2 key)',  'name' => 'full_res_url',  'type' => 'text', 'required' => 1 ],
                [ 'key' => 'field_ncm_duration',      'label' => 'Duration (seconds)',     'name' => 'duration',      'type' => 'number', 'min' => 0,
                  'conditional_logic' => [ [ [ 'field' => 'field_ncm_media_type', 'operator' => '==', 'value' => 'video' ] ] ] ],
                [ 'key' => 'field_ncm_featured',      'label' => 'Featured Asset', 'name' => 'featured',      'type' => 'true_false', 'ui' => 1 ],
                [ 'key' => 'field_ncm_download_count','label' => 'Download Count', 'name' => 'download_count','type' => 'number', 'default_value' => 0 ],
            ],
            'location' => [ [ [ 'param' => 'post_type', 'operator' => '==', 'value' => 'stock_asset' ] ] ],
            'position' => 'normal',
            'active'   => true,
        ] );
    }
}
