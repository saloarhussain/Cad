import { createClient } from './supabaseServer';

/**
 * Generates a signed URL for a file in the Supabase storage bucket.
 * Default expiration is 60 seconds.
 */
export async function getSignedUrl(path: string, bucket: string = 'project-assets', expiresIn: number = 60, downloadName?: string) {
  const supabase = await createClient();
  
  const options: any = {};
  if (downloadName) {
    options.download = downloadName;
  }

  const { data, error } = await supabase
    .storage
    .from(bucket)
    .createSignedUrl(path, expiresIn, options);

  if (error) {
    console.error('[getSignedUrl] Error:', error.message);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

export async function uploadFile(file: File | Buffer, path: string, bucket: string = 'project-assets') {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .storage
    .from(bucket)
    .upload(path, file, {
      upsert: true,
      contentType: (file instanceof File) ? file.type : 'image/jpeg'
    });

  if (error) {
    console.error('[uploadFile] Error:', error.message);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return data.path;
}

