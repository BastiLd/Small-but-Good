import { useEffect, useState } from "react";
import CreatorProfileView from "../../components/CreatorProfileView";
import { fetchPublicAppsByCreatorSlug } from "../../lib/public-apps";
import { fetchPublicProjectsByCreatorSlug } from "../../lib/public-projects";
import { mergeFeedProjects } from "../../lib/project-utils";
import {
  fetchServerPublicCreatorBySlug,
  fetchServerPublicCreators
} from "../../lib/public-creators";
import { fetchServerPublicAppsByCreatorSlug } from "../../lib/public-apps-server";
import { fetchServerProjectsByCreatorSlug } from "../../lib/public-projects-server";

export async function getStaticPaths() {
  const creators = await fetchServerPublicCreators();

  return {
    paths: creators.map((creator) => ({ params: { slug: creator.slug } })),
    fallback: false
  };
}

export async function getStaticProps({ params }) {
  const creator = await fetchServerPublicCreatorBySlug(params?.slug);

  if (!creator) {
    return {
      notFound: true
    };
  }

  const [appProjects, communityProjects] = await Promise.all([
    fetchServerPublicAppsByCreatorSlug(creator.slug),
    fetchServerProjectsByCreatorSlug(creator.slug)
  ]);

  return {
    props: {
      creator,
      projects: mergeFeedProjects(appProjects, communityProjects)
    }
  };
}

export default function PublicCreatorProfilePage({ creator, projects: initialProjects }) {
  const [projects, setProjects] = useState(initialProjects);

  useEffect(() => {
    let active = true;

    async function loadLatestProjects() {
      const [nextAppProjects, nextCommunityProjects] = await Promise.all([
        fetchPublicAppsByCreatorSlug(creator.slug),
        fetchPublicProjectsByCreatorSlug(creator.slug)
      ]);
      const nextProjects = mergeFeedProjects(nextAppProjects, nextCommunityProjects);

      if (active && (nextProjects.length || !projects.length)) {
        setProjects(nextProjects);
      }
    }

    loadLatestProjects();

    return () => {
      active = false;
    };
  }, [creator.slug, projects.length]);

  return <CreatorProfileView creator={creator} projects={projects} />;
}
