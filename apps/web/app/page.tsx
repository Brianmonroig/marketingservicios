import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-pine">Agencias</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Marketing Servicios Local</h1>
      <p className="mt-4 max-w-xl text-lg text-stone-700">
        Cada agencia entra con su propio espacio. El correo recibe un código para confirmar la cuenta y otro cada vez que alguien entra.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/registro" className="rounded-md bg-pine px-4 py-2 text-sm font-medium text-white">
          Crear agencia
        </Link>
        <Link href="/login" className="rounded-md border border-line bg-white px-4 py-2 text-sm font-medium">
          Entrar
        </Link>
      </div>
    </main>
  );
}
