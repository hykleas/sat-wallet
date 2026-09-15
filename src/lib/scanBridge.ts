/**
 * QR tarama sonucunu, ekranlar arası param taşımadan, tarayıcıyı açan ekrana
 * geri iletmek için minik bir köprü. Gönderen ekran dinleyicisini kaydeder,
 * tarayıcı bir sonuç bulunca çağırır ve geri döner.
 */
type Listener = (value: string) => void;

let listener: Listener | null = null;

export function setScanListener(l: Listener | null) {
  listener = l;
}

export function emitScan(value: string) {
  listener?.(value);
}
