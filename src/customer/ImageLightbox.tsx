interface ImageLightboxProps {
  imageUrl: string | null
  onClose: () => void
}

export function ImageLightbox({ imageUrl, onClose }: ImageLightboxProps) {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 transition-opacity duration-200 ${
        imageUrl ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
      onClick={onClose}
    >
      {imageUrl && <img src={imageUrl} alt="" className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain" />}
    </div>
  )
}
