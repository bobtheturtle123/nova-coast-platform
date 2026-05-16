<?php
defined( 'ABSPATH' ) || exit;

class NCM_CSV_Importer {
    private static ?self $instance = null;
    public static function instance(): self {
        if ( null === self::$instance ) self::$instance = new self();
        return self::$instance;
    }
    public function init(): void {
        add_action( 'admin_post_ncm_import_csv', [ $this, 'handle_upload' ] );
    }
    public function handle_upload(): void {
        if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Unauthorized' );
        check_admin_referer( 'ncm_csv_import' );
        if ( empty( $_FILES['csv_file']['tmp_name'] ) ) {
            $this->redirect( 'No file uploaded.', 'error' ); return;
        }
        $r = $this->import_file( $_FILES['csv_file']['tmp_name'] );
        $this->redirect( "Import complete: {$r['created']} created, {$r['updated']} updated, {$r['skipped']} skipped." );
    }
    public function import_file( string $path ): array {
        $s = [ 'created' => 0, 'updated' => 0, 'skipped' => 0 ];
        $h = fopen( $path, 'r' );
        if ( ! $h ) return $s;
        $headers = array_map( 'trim', fgetcsv( $h ) ?: [] );
        while ( ( $row = fgetcsv( $h ) ) !== false ) {
            if ( count( $row ) < count( $headers ) ) { $s['skipped']++; continue; }
            $data   = array_map( 'trim', array_combine( $headers, $row ) );
            $s[ $this->import_row( $data ) ]++;
        }
        fclose( $h );
        return $s;
    }
    private function import_row( array $d ): string {
        $title = sanitize_text_field( $d['title'] ?? '' );
        $slug  = sanitize_title( $d['slug'] ?? $title );
        if ( ! $title ) return 'skipped';
        $media  = in_array( $d['media_type'] ?? '', [ 'photo', 'video' ], true ) ? $d['media_type'] : 'photo';
        $orient = in_array( $d['orientation'] ?? '', [ 'horizontal', 'vertical' ], true ) ? $d['orientation'] : 'horizontal';
        $exist  = get_page_by_path( $slug, OBJECT, 'stock_asset' );
        $args   = [ 'post_title' => $title, 'post_name' => $slug, 'post_type' => 'stock_asset', 'post_status' => 'publish', 'post_content' => '' ];
        if ( $exist ) { $args['ID'] = $exist->ID; wp_update_post( $args ); $pid = $exist->ID; $action = 'updated'; }
        else { $pid = wp_insert_post( $args ); if ( is_wp_error( $pid ) ) return 'skipped'; $action = 'created'; }
        update_field( 'media_type',    $media,                                      $pid );
        update_field( 'orientation',   $orient,                                     $pid );
        update_field( 'thumbnail_url', sanitize_text_field( $d['thumbnail_url'] ?? '' ), $pid );
        update_field( 'preview_url',   sanitize_text_field( $d['preview_url']   ?? '' ), $pid );
        update_field( 'full_res_url',  sanitize_text_field( $d['full_res_url']  ?? '' ), $pid );
        $this->assign_location( $pid, $d['location'] ?? '', $d['sub_location'] ?? '' );
        $this->assign_tags( $pid, $d['tags'] ?? '' );
        return $action;
    }
    private function assign_location( int $pid, string $loc, string $sub ): void {
        $ids = [];
        if ( $loc ) {
            $p = get_term_by( 'name', $loc, 'asset_location' );
            if ( $p ) {
                $ids[] = $p->term_id;
                if ( $sub ) { $c = get_term_by( 'name', $sub, 'asset_location' ); if ( $c ) $ids[] = $c->term_id; }
            }
        }
        if ( $ids ) wp_set_object_terms( $pid, $ids, 'asset_location' );
    }
    private function assign_tags( int $pid, string $tags ): void {
        $t = array_filter( array_map( 'trim', explode( ',', $tags ) ) );
        if ( $t ) wp_set_object_terms( $pid, $t, 'asset_tag' );
    }
    private function redirect( string $msg, string $type = 'success' ): void {
        wp_safe_redirect( add_query_arg( [ 'page' => 'ncm-csv-import', 'ncm_notice' => urlencode( $msg ), 'ncm_notice_type' => $type ], admin_url( 'admin.php' ) ) );
        exit;
    }
}
