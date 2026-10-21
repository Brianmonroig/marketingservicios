import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function ChannelsConfigPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "agent") {
    return (
      <>
        <h1 className="page-title">
          Sin <em>permiso</em>.
        </h1>
        <p className="panel-note">Solo dueños y administradores configuran canales.</p>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">
            <span className="pulse" />
            Configuración · Canales
          </p>
          <h1 className="page-title">
            Telegram y <em>correo</em>.
          </h1>
        </div>
      </div>

      <div className="split">
        <div className="panel">
          <h2>Telegram</h2>
          <p className="panel-note">
            Espacio para políticas propias del bot/token y reglas de campaña. El envío y recepción reales se conectan
            cuando autorices la integración; aquí solo queda la configuración.
          </p>
          <div className="form-grid">
            <label className="field">
              <span>Token del bot</span>
              <input className="input" name="telegramToken" placeholder="Pendiente de guardar en servidor" disabled />
            </label>
            <label className="field">
              <span>Política de opt-in</span>
              <textarea className="textarea" name="telegramPolicy" rows={3} placeholder="Describe tu política de consentimiento" disabled />
            </label>
          </div>
          <p className="panel-note" style={{ marginTop: "1rem", marginBottom: 0 }}>
            Guardado persistente: pendiente (documentado en PENDIENTES).
          </p>
        </div>

        <div className="panel">
          <h2>Correo genérico</h2>
          <p className="panel-note">
            Remitente y proveedor para campañas compatibles con correo. No usa SMTP de Render; hará falta una API de
            correo cuando se active el envío.
          </p>
          <div className="form-grid">
            <label className="field">
              <span>Remitente</span>
              <input className="input" name="emailFrom" placeholder="Nombre &lt;hola@tudominio.com&gt;" disabled />
            </label>
            <label className="field">
              <span>Proveedor</span>
              <select className="select" name="emailProvider" disabled defaultValue="">
                <option value="">Elegir más adelante</option>
                <option value="resend">Resend</option>
                <option value="brevo">Brevo</option>
                <option value="other">Otro</option>
              </select>
            </label>
          </div>
          <p className="panel-note" style={{ marginTop: "1rem", marginBottom: 0 }}>
            Guardado persistente: pendiente (documentado en PENDIENTES).
          </p>
        </div>
      </div>
    </>
  );
}
