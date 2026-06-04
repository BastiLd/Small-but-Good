import { useEffect, useState } from "react";
import DetailView from "../../components/DetailView";
import { fetchPublicProjectBySlug } from "../../lib/public-projects";
import {
  fetchServerPublicProjectBySlug,
  fetchServerPublicProjects
} from "../../lib/public-projects-server";

export async function getStaticPaths() {
  const projects = await fetchServerPublicProjects();

  return {
    paths: projects.map((project) => ({ params: { slug: project.runtimeId } })),
    fallback: false
  };
}

export async function getStaticProps({ params }) {
  const project = await fetchServerPublicProjectBySlug(params?.slug);

  if (!project) {
    return {
      notFound: true
    };
  }

  return {
    props: {
      project
    }
  };
}

export default function PublicProjectDetailPage({ project: initialProject }) {
  const [project, setProject] = useState(initialProject);

  useEffect(() => {
    let active = true;

    async function loadLatestProject() {
      const nextProject = await fetchPublicProjectBySlug(initialProject?.runtimeId);

      if (active && nextProject) {
        setProject(nextProject);
      }
    }

    loadLatestProject();

    return () => {
      active = false;
    };
  }, [initialProject?.runtimeId]);

  return (
    <DetailView
      item={project}
      footerNote="Dieses Community-Projekt wurde über CuratedHub eingereicht und freigegeben."
    />
  );
}
