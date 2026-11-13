import { useState } from "react";
import { Check, Copy } from "lucide-react";

async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // segue para o fallback
  }
  // Fallback para navegadores/contextos sem Clipboard API.
  try {
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({
  texto,
  label = "Copiar",
  copiadoLabel = "Copiado!",
  className = "btn-ghost",
}: {
  texto: string;
  label?: string;
  copiadoLabel?: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const [falhou, setFalhou] = useState(false);

  const handleClick = async () => {
    const ok = await copiarTexto(texto);
    if (ok) {
      setFalhou(false);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } else {
      setFalhou(true);
      window.setTimeout(() => setFalhou(false), 3000);
    }
  };

  return (
    <button type="button" className={className} onClick={handleClick}>
      {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {falhou ? "Falha ao copiar" : copiado ? copiadoLabel : label}
    </button>
  );
}
