import Link from "next/link";

export type SavedAddress = {
  id: number;
  label: string;
  recipient: string;
  phone: string;
  country: string;
  province: string;
  city: string;
  address: string;
  postalCode?: string;
  notes?: string;
  isDefault: boolean;
};

export function AddressSelector({
  loadingAddresses,
  isAuthenticated,
  addressLoadError,
  savedAddresses,
  selectedAddressId,
  onSelectAddress,
}: {
  loadingAddresses: boolean;
  isAuthenticated: boolean | null;
  addressLoadError: boolean;
  savedAddresses: SavedAddress[];
  selectedAddressId: number | null;
  onSelectAddress: (id: number) => void;
}) {
  return (
    <fieldset className="mb-5">
      <legend className="mb-2 text-xs font-bold text-gray-700">Escolha um endereço guardado</legend>

      {loadingAddresses && (
        <p role="status" className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-500">
          A carregar os endereços da conta...
        </p>
      )}

      {!loadingAddresses && isAuthenticated === false && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-bold">Entre na sua conta para escolher um endereço</p>
          <p className="mt-1 text-xs leading-5 text-blue-800">
            Pode iniciar sessão ou criar uma conta nova para guardar a morada e continuar a compra.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/login" className="btn-primary">Entrar na conta</Link>
            <Link href="/register" className="btn-secondary">Criar conta</Link>
          </div>
        </div>
      )}

      {!loadingAddresses && isAuthenticated === true && addressLoadError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>Não foi possível carregar os endereços da conta.</p>
          <Link href="/account/addresses" className="mt-2 inline-block font-bold text-primary hover:underline">
            Gerir endereços da conta
          </Link>
        </div>
      )}

      {!loadingAddresses && isAuthenticated === true && !addressLoadError && savedAddresses.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
          <p>Ainda não tem endereços guardados na sua conta.</p>
          <Link href="/account/addresses" className="mt-3 inline-flex btn-secondary">
            Adicionar endereço na conta
          </Link>
        </div>
      )}

      {!loadingAddresses && savedAddresses.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {savedAddresses.map((savedAddress) => (
            <label
              key={savedAddress.id}
              className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
                selectedAddressId === savedAddress.id
                  ? "border-primary bg-blue-50/60 ring-1 ring-primary"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="savedAddress"
                value={savedAddress.id}
                checked={selectedAddressId === savedAddress.id}
                onChange={() => onSelectAddress(savedAddress.id)}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-900">
                  {savedAddress.label}
                  {savedAddress.isDefault && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                      Principal
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs leading-5 text-gray-600">
                  {savedAddress.recipient}
                  <br />
                  {savedAddress.address}
                  <br />
                  {savedAddress.city}, {savedAddress.province}
                  {savedAddress.postalCode ? ` · ${savedAddress.postalCode}` : ""}
                  <br />
                  {savedAddress.phone}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
