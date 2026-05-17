<?php
defined( 'ABSPATH' ) || exit;

/**
 * Native WordPress meta box — replaces ACF entirely.
 * Stores fields under ncm_* keys in wp_postmeta.
 */
class NCM_Meta_Boxes {

    private static ?self $instance = null;

    public static function instance(): self {
        if ( null === self::$instance ) self::$instance = new self();
        return self::$instance;
    }

    public function init(): void {
        add_action( 'add_meta_boxes',          [ $this, 'register' ] );
        add_action( 'save_post_stock_asset',   [ $this, 'save' ], 10, 2 );
    }

    public function register(): void {
        add_meta_box(
            'ncm_asset_details',
            'Asset Details',
            [ $this, 'render' ],
            'stock_asset',
            'normal',
            'high'
        );
    }

    public function render( WP_Post $post ): void {
        wp_nonce_field( 'ncm_save_asset_meta', 'ncm_meta_nonce' );
        $id     = $post->ID;
        $type   = get_post_meta( $id, 'ncm_media_type',    true ) ?: 'photo';
        $orient = get_post_meta( $id, 'ncm_orientation',   true ) ?: 'horizontal';
        $thumb  = get_post_meta( $id, 'ncm_thumbnail_url', true );
        $prev   = get_post_meta( $id, 'ncm_preview_url',   true );
        $full   = get_post_meta( $id, 'ncm_full_res_url',  true );
        $dur    = get_post_meta( $id, 'ncm_duration',      true );
        $feat   = get_post_meta( $id, 'ncm_featured',      true );
        $dlc    = (int) get_post_meta( $id, 'ncm_download_count', true );
        ?>
        <style>
        #ncm_asset_details table { width:100%; border-collapse:collapse; }
        #ncm_asset_details th { width:190px; font-weight:600; font-size:13px; padding:10px 12px 10px 0; vertical-align:top; }
        #ncm_asset_details td { padding:8px 0; }
        #ncm_asset_details input[type="text"],
        #ncm_asset_details input[type="number"],
        #ncm_asset_details select { width:100%; max-width:520px; }
        #ncm_asset_details .ncm-desc { font-size:12px; color:#666; margin-top:4px; display:block; }
        #ncm_asset_details tr { border-bottom:1px solid #f0f0f0; }
        #ncm_asset_details tr:last-child { border-bottom:none; }
        </style>

        <table>
            <tr>
                <th><label for="ncm_media_type">Media Type</label></th>
                <td>
                    <select id="ncm_media_type" name="ncm_media_type">
                        <option value="photo" <?php selected( $type, 'photo' ); ?>>Photo</option>
                        <option value="video" <?php selected( $type, 'video' ); ?>>Video</option>
                    </select>
                </td>
            </tr>
            <tr>
                <th><label for="ncm_orientation">Orientation</label></th>
                <td>
                    <select id="ncm_orientation" name="ncm_orientation">
                        <option value="horizontal" <?php selected( $orient, 'horizontal' ); ?>>Horizontal (16:9 landscape)</option>
                        <option value="vertical"   <?php selected( $orient, 'vertical' ); ?>>Vertical (4:5 portrait)</option>
                    </select>
                </td>
            </tr>
            <tr>
                <th><label for="ncm_thumbnail_url">Thumbnail (R2 key)</label></th>
                <td>
                    <input type="text" id="ncm_thumbnail_url" name="ncm_thumbnail_url" value="<?php echo esc_attr( $thumb ); ?>">
                    <span class="ncm-desc">Path inside your R2 bucket. For videos this is optional — the preview video shows its own first frame.<br>Example: <code>thumbnails/la-jolla-sunset-thumb.jpg</code></span>
                </td>
            </tr>
            <tr>
                <th><label for="ncm_preview_url">Preview (R2 key)</label></th>
                <td>
                    <input type="text" id="ncm_preview_url" name="ncm_preview_url" value="<?php echo esc_attr( $prev ); ?>">
                    <span class="ncm-desc">Watermarked / compressed version shown in the grid and on hover.<br>Example: <code>previews/la-jolla-sunset-preview.mp4</code></span>
                </td>
            </tr>
            <tr>
                <th><label for="ncm_full_res_url">Full-Res (R2 key)</label></th>
                <td>
                    <input type="text" id="ncm_full_res_url" name="ncm_full_res_url" value="<?php echo esc_attr( $full ); ?>">
                    <span class="ncm-desc">Original-quality file. Subscribers download this via a secure 5-minute signed URL.<br>Example: <code>full/la-jolla-sunset-full.mp4</code></span>
                </td>
            </tr>
            <tr id="ncm-duration-row" <?php echo $type !== 'video' ? 'style="display:none"' : ''; ?>>
                <th><label for="ncm_duration">Duration (seconds)</label></th>
                <td>
                    <input type="number" id="ncm_duration" name="ncm_duration" value="<?php echo esc_attr( $dur ); ?>" min="0" style="max-width:120px;">
                    <span class="ncm-desc">e.g. enter <code>47</code> for a 0:47 clip</span>
                </td>
            </tr>
            <tr>
                <th>Featured Asset</th>
                <td>
                    <label>
                        <input type="checkbox" name="ncm_featured" value="1" <?php checked( $feat, '1' ); ?>>
                        Show in Featured Collection on landing page
                    </label>
                </td>
            </tr>
            <tr>
                <th><label for="ncm_download_count">Download Count</label></th>
                <td>
                    <input type="number" id="ncm_download_count" name="ncm_download_count" value="<?php echo esc_attr( $dlc ); ?>" min="0" style="max-width:120px;">
                    <span class="ncm-desc">Auto-incremented on each subscriber download. Edit to seed a starting number.</span>
                </td>
            </tr>
        </table>

        <script>
        document.getElementById('ncm_media_type').addEventListener('change', function () {
            document.getElementById('ncm-duration-row').style.display = this.value === 'video' ? '' : 'none';
        });
        </script>
        <?php
    }

    public function save( int $post_id, WP_Post $post ): void {
        if ( ! isset( $_POST['ncm_meta_nonce'] ) ) return;
        if ( ! wp_verify_nonce( $_POST['ncm_meta_nonce'], 'ncm_save_asset_meta' ) ) return;
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) return;
        if ( ! current_user_can( 'edit_post', $post_id ) ) return;

        $text_fields = [ 'ncm_thumbnail_url', 'ncm_preview_url', 'ncm_full_res_url' ];
        foreach ( $text_fields as $key ) {
            if ( isset( $_POST[ $key ] ) ) {
                update_post_meta( $post_id, $key, sanitize_text_field( $_POST[ $key ] ) );
            }
        }

        $allowed_types   = [ 'photo', 'video' ];
        $allowed_orients = [ 'horizontal', 'vertical' ];
        $media_type = sanitize_text_field( $_POST['ncm_media_type'] ?? 'photo' );
        $orient     = sanitize_text_field( $_POST['ncm_orientation'] ?? 'horizontal' );
        if ( in_array( $media_type, $allowed_types,   true ) ) update_post_meta( $post_id, 'ncm_media_type',  $media_type );
        if ( in_array( $orient,     $allowed_orients, true ) ) update_post_meta( $post_id, 'ncm_orientation', $orient );

        update_post_meta( $post_id, 'ncm_duration',       absint( $_POST['ncm_duration']       ?? 0 ) );
        update_post_meta( $post_id, 'ncm_download_count', absint( $_POST['ncm_download_count'] ?? 0 ) );
        update_post_meta( $post_id, 'ncm_featured', isset( $_POST['ncm_featured'] ) ? '1' : '0' );
    }
}
