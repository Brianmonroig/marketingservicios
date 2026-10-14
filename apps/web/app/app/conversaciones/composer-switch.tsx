import { TemplateComposer, TextComposer } from "@/components/composer";
import type { TemplateRow } from "@/lib/api";

// Con la ventana abierta se escribe texto libre. Cerrada, solo hay plantillas.
export function Composer({
  conversationId,
  windowOpen,
  canSendTemplate,
  templates,
  templatesError,
}: {
  conversationId: string;
  windowOpen: boolean;
  canSendTemplate: boolean;
  templates: TemplateRow[];
  templatesError: string | null;
}) {
  if (windowOpen) return <TextComposer conversationId={conversationId} />;
  if (templatesError) {
    return (
      <div className="composer">
        <div className="notice">
          La ventana de 24 h está cerrada y no se pudieron cargar las plantillas: {templatesError}
        </div>
      </div>
    );
  }
  return <TemplateComposer conversationId={conversationId} templates={templates} canSend={canSendTemplate} windowOpen={false} />;
}
