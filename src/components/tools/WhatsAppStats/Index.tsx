import { Provider } from "jotai";
import WhatsappStats from "./WhatsAppStats";

export default function Index() {
  return (
    <>
      <Provider>
        <WhatsappStats />
      </Provider>
    </>
  );
}
