import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

type Props = {
  value: string;
  height?: number;
  width?: number;
  fontSize?: number;
  displayValue?: boolean;
};

export function Barcode({ value, height = 50, width = 1.6, fontSize = 14, displayValue = true }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        height,
        width,
        fontSize,
        displayValue,
        margin: 0,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch {
      // invalid value — render nothing
    }
  }, [value, height, width, fontSize, displayValue]);
  return <svg ref={ref} />;
}
