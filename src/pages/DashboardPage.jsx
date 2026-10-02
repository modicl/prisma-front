/**
 * Dashboard Page
 * Página principal de docente autenticado
 * Muestra estadísticas, estudiantes recientes y acciones rápidas
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useActiveSession } from '../context/ActiveSessionContext';
import { useNavigate } from 'react-router-dom';
import MainContainer from '../components/layout/MainContainer';
import { Card, Badge, Button, Alert, Spinner } from '../components/ui';
import dashboardService from '../services/dashboardService';
import adminPanelService from '../services/adminPanelService';

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activeSession } = useActiveSession();
  const enCurso = activeSession?.phase === 'running' || activeSession?.phase === 'awaiting_hitl';

  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = 'P.R.I.S.M.A. - Inicio';
  }, []);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        const mockStats = {
          totalStudents: 12,
          activePACIs: 5,
          completedAdaptations: 23,
          pendingReview: 2,
        };

        const mockStudents = [
          { id: 1, name: 'Pablo Rodríguez', nee: 'Dislexia', lastUpdated: '2025-04-15' },
          { id: 2, name: 'María García', nee: 'Discalculia', lastUpdated: '2025-04-14' },
          { id: 3, name: 'Juan López', nee: 'TDAH', lastUpdated: '2025-04-12' },
        ];

        const mockMaterials = [
          { id: 1, title: 'Matemáticas - Fracciones', date: '2025-04-16', students: 3 },
          { id: 2, title: 'Lenguaje - Comprensión Lectora', date: '2025-04-15', students: 5 },
          { id: 3, title: 'Ciencias - Sistema Digestivo', date: '2025-04-14', students: 2 },
        ];

        let activeAnnouncements = [];
        try {
          activeAnnouncements = await adminPanelService.getActiveAnnouncements();
        } catch (err) {
          console.warn('No se pudieron cargar anuncios:', err.message);
        }

        setStats(mockStats);
        setStudents(mockStudents);
        setMaterials(mockMaterials);
        setAnnouncements(Array.isArray(activeAnnouncements) ? activeAnnouncements : []);
      } catch (err) {
        setError(err.message || 'Error al cargar datos del dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <MainContainer>
        <div className="flex items-center justify-center min-h-screen">
          <Spinner size="lg" />
        </div>
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <div className="space-y-8">
        {/* Header con bienvenida */}
        <div className="pt-8">
          <h1 className="text-4xl font-bold text-gray-900 font-headline">
            ¡Hola, {user?.nombre || 'Docente'}! 👋
          </h1>
          <p className="text-gray-600 mt-2 font-body">
            Bienvenido a P.R.I.S.M.A. Adaptador de Contenidos para Necesidades Educativas Especiales
          </p>
        </div>

        {/* Proceso en curso: permite retomar una sesión que quedó abierta */}
        {enCurso && (
          <Alert variant="info">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                Tienes un proceso en curso
                {activeSession.phase === 'awaiting_hitl' ? ': revisión pendiente de tu parte.' : '.'}
              </span>
              <Button variant="primary" onClick={() => navigate(`/sesion/${activeSession.sessionId}`)}>
                Continuar
              </Button>
            </div>
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="error">
            {error}
          </Alert>
        )}

        {/* Anuncios Activos */}
        {announcements.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 font-headline">
              📢 Anuncios
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {announcements.map((announcement) => (
                <Card key={announcement.id} variant="elevated">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 font-body">{announcement.title}</h3>
                      <Badge variant="info">{announcement.audience}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{announcement.body}</p>
                    {announcement.startsAt && (
                      <div className="text-xs text-gray-400">
                        Desde: {new Date(announcement.startsAt).toLocaleString('es-CL')}
                      </div>
                    )}
                    {announcement.endsAt && (
                      <div className="text-xs text-gray-400">
                        Hasta: {new Date(announcement.endsAt).toLocaleString('es-CL')}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-24 w-full max-w-7xl">
          <Button
            onClick={() => navigate('/paci')}
            className="h-auto p-4"
          >
            <div className="text-left">
              <div className="text-lg font-semibold">Nuevo PACI</div>
              <div className="text-sm opacity-90">Crear plan de adaptación</div>
            </div>
          </Button>
          <Button
            variant="outline"
            onClick={() => {}}
            className="h-auto p-4"
          >
            <div className="text-left">
              <div className="text-lg font-semibold">Mis Materiales</div>
              <div className="text-sm opacity-90">Ver biblioteca</div>
            </div>
          </Button>
        </div>
      </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div className="text-center py-4">
              <div className="text-3xl font-bold text-primary-600 font-headline">
                {stats?.totalStudents || 0}
              </div>
              <div className="text-sm text-gray-600 mt-1">Estudiantes</div>
            </div>
          </Card>
          <Card>
            <div className="text-center py-4">
              <div className="text-3xl font-bold text-secondary-600 font-headline">
                {stats?.activePACIs || 0}
              </div>
              <div className="text-sm text-gray-600 mt-1">PACIs Activos</div>
            </div>
          </Card>
          <Card>
            <div className="text-center py-4">
              <div className="text-3xl font-bold text-green-600 font-headline">
                {stats?.completedAdaptations || 0}
              </div>
              <div className="text-sm text-gray-600 mt-1">Adaptaciones</div>
            </div>
          </Card>
          <Card>
            <div className="text-center py-4">
              <div className="text-3xl font-bold text-orange-600 font-headline">
                {stats?.pendingReview || 0}
              </div>
              <div className="text-sm text-gray-600 mt-1">Pendientes</div>
            </div>
          </Card>
        </div>

        {/* Estudiantes Recientes */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4 font-headline">
            Estudiantes Recientes
          </h2>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Nombre</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">NEE</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Última actualización</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length > 0 ? (
                    students.map((student) => (
                      <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-gray-900">{student.name}</td>
                        <td className="py-3 px-4">
                          <Badge variant="info">{student.nee}</Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{student.lastUpdated}</td>
                        <td className="py-3 px-4 text-right">
                          <button className="text-primary-600 hover:text-primary-700 font-semibold text-sm transition-colors">
                            Ver →
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-gray-500">
                        No hay estudiantes registrados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Materiales Recientes */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4 font-headline">
            Materiales Adaptados Recientemente
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {materials.length > 0 ? (
              materials.map((material) => (
                <Card key={material.id} variant="elevated">
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2 font-body">
                      {material.title}
                    </h3>
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                      <span>{material.date}</span>
                      <Badge variant="success">{material.students} estudiantes</Badge>
                    </div>
                    <button className="w-full text-primary-600 hover:text-primary-700 font-semibold transition-colors">
                      Descargar →
                    </button>
                  </div>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-8 text-gray-500">
                No hay materiales adaptados aún
              </div>
            )}
          </div>
        </div>

        {/* Info Section */}
        <Card variant="flat">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 font-headline">
              💡 ¿Cómo usar P.R.I.S.M.A.?
            </h3>
            <ol className="space-y-2 text-gray-700 list-decimal list-inside font-body">
              <li>Crea un PACI (Plan de Adaptación Curricular Individualizado) para cada estudiante</li>
              <li>Carga contenidos que desees adaptar</li>
              <li>Usa el Ajustador IA para generar versiones adaptadas automáticamente</li>
              <li>Revisa y aprueba las adaptaciones</li>
              <li>Descarga los materiales listos para usar</li>
            </ol>
          </div>
        </Card>

        {/* Spacing bottom */}
        <div className="pb-8"></div>
      </div>
    </MainContainer>
  );
};

export default DashboardPage;
