import "../app/globals.css";
import Layout from "../components/Layout";

export default function LegacyApp({ Component, pageProps }) {
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}
