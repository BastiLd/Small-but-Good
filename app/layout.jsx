import "./globals.css";
import Layout from "../components/Layout";

export const metadata = {
  title: "Curated App/Bot Discovery",
  description: "Discover high-quality apps and bots"
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>
        <Layout>{children}</Layout>
      </body>
    </html>
  );
}
