import { Modal } from "@/components/app-ui/modal"

function sizeText(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return ""
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1).replace(".", ",")} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`
}

// Aperçu d'une image avant l'envoi. `previewUrl` est une adresse locale du navigateur (blob), jamais envoyée.
export function ImageDialog({ file, previewUrl, onConfirm, onCancel }) {
  return (
    <Modal
      open
      onClose={onCancel}
      size="sm"
      title="Envoyer cette image ?"
      footer={
        <>
          <button type="button" className="btn btn--soft" onClick={onCancel}>
            Annuler
          </button>
          <button type="button" className="btn btn--primary" onClick={onConfirm}>
            Envoyer
          </button>
        </>
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="dialog-image2" src={previewUrl} alt="Aperçu de l'image à envoyer" />
      <p className="dialog-note2">{sizeText(file?.size)}</p>
    </Modal>
  )
}

export default ImageDialog
