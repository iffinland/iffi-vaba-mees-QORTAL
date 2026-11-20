import { Routes, Route } from 'react-router-dom';
import './App.css'
import Layout from './components/Layout/Layout';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import HomePage from './pages/HomePage/HomePage';
import PostPage from './pages/PostPage/PostPage';
import ProjectsPage from './pages/ProjectsPage/ProjectsPage';
import ProjectListPage from './pages/ProjectListPage/ProjectListPage';
import ProjectDetailPage from './pages/ProjectDetailPage/ProjectDetailPage';
import ContactPage from './pages/ContactPage/ContactPage';
import GalleryPage from './pages/GalleryPage/GalleryPage';
import GalleryDetailPage from './pages/GalleryDetailPage/GalleryDetailPage';
import GuestbookPage from './pages/GuestbookPage/GuestbookPage'; // Veendu, et see rida on olemas
import VideoDetailPage from './pages/VideoDetailPage/VideoDetailPage';
import VideosPage from './pages/VideosPage/VideosPage';
import BlogPage from './pages/BlogPage/BlogPage';
import BlogDetailPage from './pages/BlogDetailPage/BlogDetailPage';
import StorybookPage from './pages/StorybookPage/StorybookPage';
import StoryEntryDetailPage from './pages/StoryEntryDetailPage/StoryEntryDetailPage';
import PizzaSupportPage from './pages/PizzaSupportPage/PizzaSupportPage';
import { SUPPORT_ROUTE } from './services/pizzaSupportService';

function App() {
  return (
    <Layout>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/post/:postId" element={<PostPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectType" element={<ProjectListPage />} />
          <Route path="/projects/item/:projectId" element={<ProjectDetailPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/gallery/:galleryId" element={<GalleryDetailPage />} />
          <Route path="/videos" element={<VideosPage />} />
          <Route path="/videos/:videoId" element={<VideoDetailPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/guestbook" element={<GuestbookPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:postId" element={<BlogDetailPage />} />
          <Route path="/storybook" element={<StorybookPage />} />
          <Route path="/storybook/:entryId" element={<StoryEntryDetailPage />} />
          <Route path={SUPPORT_ROUTE} element={<PizzaSupportPage />} />
          {/* Võid lisada ka veateate lehe, kui URL on vale */}
          <Route path="*" element={<h1>404: Page Not Found</h1>} />
        </Routes>
      </main>
      <Footer />
    </Layout>
  )
}

export default App
