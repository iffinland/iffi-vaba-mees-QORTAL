import RichTextContent from '../../components/common/RichTextContent';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FaEdit, FaExternalLinkAlt } from 'react-icons/fa';
import ProjectPublishModal from '../../components/projects/ProjectPublishModal';
import {
  fetchProjectByIdentifier,
  getCurrentUserProfile,
  updateProject,
} from '../../services/projectService';
import { isOwnerName } from '../../utils/siteConfig';
import styles from './ProjectDetailPage.module.css';

const statusLabels = {
  idea: 'Idea',
  active: 'Active',
  paused: 'Paused',
  released: 'Released',
};

const typeLabels = {
  own: 'Own project',
  collaboration: 'Collaboration project',
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

function ProjectDetailPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [profile, setProfile] = useState({ address: '', name: '', names: [] });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setProfile(await getCurrentUserProfile());
      } catch (err) {
        console.warn('Unable to load Qortal profile', err);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    const loadProject = async () => {
      setIsLoading(true);
      setError('');

      try {
        const nextProject = await fetchProjectByIdentifier(decodeURIComponent(projectId || ''));
        setProject(nextProject);
      } catch (err) {
        setError(err?.message || 'Unable to load project.');
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [projectId]);

  const canEditProject = isOwnerName(profile.name);

  const saveProjectEdits = async (form) => {
    if (!project || !canEditProject) {
      throw new Error('Only the site owner can edit this project.');
    }

    setIsSaving(true);
    setError('');

    try {
      const updatedProject = await updateProject({
        project,
        form,
        authorName: profile.name,
      });
      setProject(updatedProject);
      setIsEditOpen(false);
      notify('Project updated.');
      return updatedProject;
    } catch (err) {
      setError(err?.message || 'Unable to update project.');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <p className={styles.status}>Loading project...</p>;
  }

  if (!project) {
    return (
      <section className={styles.page}>
        <Link to="/projects" className={styles.backLink}>Back to projects</Link>
        <p className={styles.status}>{error || 'Project not found.'}</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <Link to={`/projects/${project.type}`} className={styles.backLink}>
        Back to {project.type === 'collaboration' ? 'collaboration projects' : 'own projects'}
      </Link>

      <article className={styles.detail}>
        {project.coverUrl && (
          <div className={styles.cover}>
            <img src={project.coverUrl} alt={project.title || 'Project cover'} />
          </div>
        )}

        <header className={styles.header}>
          <div>
            <div className={styles.meta}>
              <span>{typeLabels[project.type]}</span>
              <span>{statusLabels[project.status] || project.status}</span>
              {project.startDate && <span>{formatDate(project.startDate)}</span>}
            </div>
            <h1>{project.title || 'Untitled project'}</h1>
            {project.role && <p className={styles.role}>{project.role}</p>}
            {project.summary && <p className={styles.summary}>{project.summary}</p>}
          </div>

          {canEditProject && (
            <button type="button" className={styles.editButton} onClick={() => setIsEditOpen(true)}>
              <FaEdit />
              <span>Edit project</span>
            </button>
          )}
        </header>

        {project.descriptionHtml && (
          <section className={styles.section}>
            <h2>Description</h2>
            <RichTextContent className={styles.richText} html={project.descriptionHtml} authorName={project.authorName} />
          </section>
        )}

        <div className={styles.columns}>
          {project.goals.length > 0 && (
            <section className={styles.section}>
              <h2>Goals</h2>
              <ul>
                {project.goals.map((goal) => (
                  <li key={goal}>{goal}</li>
                ))}
              </ul>
            </section>
          )}

          {project.roadmap.length > 0 && (
            <section className={styles.section}>
              <h2>Roadmap</h2>
              <ul>
                {project.roadmap.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {project.links.length > 0 && (
          <section className={styles.section}>
            <h2>Links</h2>
            <div className={styles.links}>
              {project.links.map((link) => (
                <a key={`${link.label}-${link.url}`} href={link.url}>
                  <FaExternalLinkAlt />
                  <span>{link.label}</span>
                </a>
              ))}
            </div>
          </section>
        )}
      </article>

      <ProjectPublishModal
        editProject={project}
        fixedType={project.type}
        isOpen={canEditProject && isEditOpen}
        isPublishing={isSaving}
        onClose={() => setIsEditOpen(false)}
        onPublish={saveProjectEdits}
      />
    </section>
  );
}

export default ProjectDetailPage;
