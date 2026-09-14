export interface CloudinaryWidgetResult {
  event: string;
  info: {
    secure_url: string;
    public_id: string;
    format: string;
    width: number;
    height: number;
    bytes: number;
    [key: string]: any;
  };
}

declare global {
  interface Window {
    cloudinary?: {
      createUploadWidget: (
        options: Record<string, any>,
        callback: (error: any, result: CloudinaryWidgetResult) => void
      ) => {
        open: () => void;
        close: () => void;
        destroy: () => void;
      };
    };
  }
}

let scriptLoadingPromise: Promise<void> | null = null;

export function loadCloudinaryScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.cloudinary) return Promise.resolve();

  if (!scriptLoadingPromise) {
    scriptLoadingPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src*="upload-widget.cloudinary.com"]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', (err) => reject(err));
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://upload-widget.cloudinary.com/global/all.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = (err) => {
        scriptLoadingPromise = null;
        reject(err);
      };
      document.head.appendChild(script);
    });
  }

  return scriptLoadingPromise;
}

export interface OpenWidgetOptions {
  onSuccess: (secureUrl: string, info: CloudinaryWidgetResult['info']) => void;
  onError?: (error: any) => void;
  folder?: string;
}

export async function openProductImageWidget({
  onSuccess,
  onError,
  folder,
}: OpenWidgetOptions): Promise<void> {
  try {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();
    const targetFolder = folder || import.meta.env.VITE_CLOUDINARY_FOLDER?.trim() || 'products';

    if (!cloudName || !uploadPreset) {
      throw new Error(
        'Configuración de Cloudinary no encontrada. Asegúrate de configurar VITE_CLOUDINARY_CLOUD_NAME y VITE_CLOUDINARY_UPLOAD_PRESET en tus variables de entorno.'
      );
    }

    await loadCloudinaryScript();

    if (!window.cloudinary) {
      throw new Error('No se pudo inicializar el servicio de Cloudinary');
    }

    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName,
        uploadPreset,
        folder: targetFolder,
        sources: ['local', 'camera', 'url'],
        multiple: false,
        resourceType: 'image',
        clientAllowedFormats: ['png', 'jpeg', 'jpg', 'webp', 'avif', 'svg'],
        maxFileSize: 10 * 1024 * 1024, // 10MB
        theme: 'minimal',
        language: 'es',
        text: {
          es: {
            or: 'O',
            back: 'Atrás',
            advanced: 'Avanzado',
            close: 'Cerrar',
            no_results: 'Sin resultados',
            search_placeholder: 'Buscar imágenes',
            about_uw: 'Acerca del Widget de subida',
            menu: {
              files: 'Mis Archivos',
              web: 'Dirección Web',
              camera: 'Tomar Foto',
            },
            local: {
              browse: 'Elegir archivo',
              dd_title_single: 'Arrastra y suelta tu foto aquí',
              drop_title_single: 'Suelta la foto para subirla',
            },
            queue: {
              title: 'Cola de subida',
              title_uploading_with_counter: 'Subiendo {{num}} foto',
              title_uploading: 'Subiendo foto...',
              title_complete: 'Subida exitosa',
              done: 'Listo',
            },
          },
        },
      },
      (error, result) => {
        if (error && onError) {
          onError(error);
          return;
        }

        if (result && result.event === 'success') {
          onSuccess(result.info.secure_url, result.info);
        }
      }
    );

    widget.open();
  } catch (err) {
    if (onError) onError(err);
    else console.error('Error al abrir Cloudinary Widget:', err);
  }
}
