<?php
defined( 'ABSPATH' ) || exit;

class NCM_Admin_Interface {
    private static ?self $instance = null;
    public static function instance(): self {
        if ( null === self::$instance ) self::$instance = new self();
        return self::$instance;
    }
    public function init(): void {
        add_action( 'admin_menu',    [ $this, 'register_menus' ] );
        add_action( 'admin_init',    [ $this, 'register_settings' ] );
        add_action( 'admin_notices', [ $this, 'show_notices' ] );
        add_filter( 'manage_stock_asset_posts_columns',       [ $this, 'add_columns' ] );
        add_action( 'manage_stock_asset_posts_custom_column', [ $this, 'render_column' ], 10, 2 );
    }
    public function register_menus(): void {
        add_submenu_page( 'edit.php?post_type=stock_asset', 'CSV Import', 'CSV Import', 'manage_options', 'ncm-csv-import', [ $this, 'page_csv' ] );
        add_submenu_page( 'edit.php?post_type=stock_asset', 'Settings',  'Settings',  'manage_options', 'ncm-settings',   [ $this, 'page_settings' ] );
    }
    public function register_settings(): void {
        register_setting( 'ncm_r2_group',   'ncm_r2_settings',   [ 'sanitize_callback' => [ $this, 'sanitize_r2' ] ] );
        register_setting( 'ncm_stripe_group', 'ncm_stripe_settings', [ 'sanitize_callback' => [ $this, 'sanitize_stripe' ] ] );
    }
    public function sanitize_stripe( array $i ): array {
        return [
            'secret_key'        => sanitize_text_field( $i['secret_key']        ?? '' ),
            'publishable_key'   => sanitize_text_field( $i['publishable_key']   ?? '' ),
            'webhook_secret'    => sanitize_text_field( $i['webhook_secret']    ?? '' ),
            'starter_price_id'  => sanitize_text_field( $i['starter_price_id']  ?? '' ),
            'growth_price_id'   => sanitize_text_field( $i['growth_price_id']   ?? '' ),
            'pro_price_id'      => sanitize_text_field( $i['pro_price_id']      ?? '' ),
            'unlimited_price_id'=> sanitize_text_field( $i['unlimited_price_id']?? '' ),
        ];
    }
    public function sanitize_r2( array $i ): array {
        return [
            'account_id'    => sanitize_text_field( $i['account_id']    ?? '' ),
            'access_key'    => sanitize_text_field( $i['access_key']    ?? '' ),
            'secret_key'    => sanitize_text_field( $i['secret_key']    ?? '' ),
            'bucket'        => sanitize_text_field( $i['bucket']        ?? '' ),
            'public_domain' => esc_url_raw(         $i['public_domain'] ?? '' ),
        ];
    }
    public function page_settings(): void { require NCM_PLUGIN_DIR . 'admin/views/settings-page.php'; }
    public function page_csv(): void      { require NCM_PLUGIN_DIR . 'admin/views/csv-import-page.php'; }
    public function add_columns( array $cols ): array {
        $new = [];
        foreach ( $cols as $k => $l ) {
            $new[$k] = $l;
            if ( $k === 'title' ) { $new['media_type'] = 'Type'; $new['orientation'] = 'Orient'; $new['location_col'] = 'Location'; $new['dl_count'] = 'Downloads'; }
        }
        return $new;
    }
    public function render_column( string $col, int $id ): void {
        switch ( $col ) {
            case 'media_type':   print( ucfirst( ncm_get( 'media_type',     $id ) ?: '—' ) ); break;
            case 'orientation':  print( ucfirst( ncm_get( 'orientation',   $id ) ?: '—' ) ); break;
            case 'dl_count':     print( (int)    ncm_get( 'download_count', $id ) );           break;
            case 'location_col': $this->col_location( $id );                                   break;
        }
    }
    private function col_location( int $id ): void {
        $t = get_the_terms( $id, 'asset_location' );
        echo ( $t && ! is_wp_error( $t ) ) ? esc_html( implode( ', ', wp_list_pluck( $t, 'name' ) ) ) : '—';
    }
    public function show_notices(): void {
        if ( empty( $_GET['ncm_notice'] ) ) return;
        $type = in_array( $_GET['ncm_notice_type'] ?? '', [ 'success', 'error', 'warning' ], true ) ? $_GET['ncm_notice_type'] : 'success';
        echo "<div class=\"notice notice-{$type} is-dismissible\"><p>" . esc_html( urldecode( $_GET['ncm_notice'] ) ) . '</p></div>';
    }
}


