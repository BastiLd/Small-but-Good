import { notFound } from "next/navigation";
import DetailView from "../../../components/DetailView";
import { fetchServerPublicAppBySlug, fetchServerPublicApps } from "../../../lib/public-apps-server";

export async function generateStaticParams() {
  const apps = await fetchServerPublicApps();
  return apps.map((app) => ({ id: app.runtimeId || app.id }));
}

export default async function AppDetailPage({ params }) {
  const app = await fetchServerPublicAppBySlug(params?.id);

  if (!app) {
    notFound();
  }

  return <DetailView item={app} altSuffix="Logo" defaultItemSource="local" />;
}
