import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { projectsAPI, todosAPI, filesAPI } from '../services/api';
import { Project, Todo, ProjectFile } from '../types';

const ProjectDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { project: initialProject } = route.params as { project: Project };
  
  const [project, setProject] = useState<Project>(initialProject);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProjectData = async () => {
    try {
      const [projectData, todosData, filesData] = await Promise.all([
        projectsAPI.getProject(project.id),
        todosAPI.getTodos(project.id),
        filesAPI.getFiles(project.id),
      ]);
      
      setProject(projectData);
      setTodos(todosData);
      setFiles(filesData);
    } catch (error) {
      console.error('Error fetching project data:', error);
      Alert.alert('Error', 'Failed to load project data');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProjectData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#16a34a';
      case 'completed': return '#2563eb';
      case 'on-hold': return '#ea580c';
      case 'cancelled': return '#dc2626';
      default: return '#64748b';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'completed': return 'Completed';
      case 'on-hold': return 'On Hold';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const TodoItem = ({ todo }: { todo: Todo }) => (
    <View style={styles.todoItem}>
      <View style={styles.todoHeader}>
        <Text style={styles.todoTitle}>{todo.title}</Text>
        <View style={[
          styles.todoPriority,
          { backgroundColor: todo.priority === 'high' ? '#ef4444' : todo.priority === 'medium' ? '#f59e0b' : '#10b981' }
        ]}>
          <Text style={styles.todoPriorityText}>{todo.priority}</Text>
        </View>
      </View>
      {todo.description && (
        <Text style={styles.todoDescription}>{todo.description}</Text>
      )}
      <View style={styles.todoFooter}>
        <Text style={styles.todoAssignee}>Assigned to: {todo.assignedTo}</Text>
        {todo.dueDate && (
          <Text style={styles.todoDueDate}>
            Due: {new Date(todo.dueDate).toLocaleDateString()}
          </Text>
        )}
      </View>
    </View>
  );

  const FileItem = ({ file }: { file: ProjectFile }) => (
    <TouchableOpacity style={styles.fileItem}>
      <Icon name="description" size={24} color="#2563eb" />
      <View style={styles.fileInfo}>
        <Text style={styles.fileName}>{file.name}</Text>
        <Text style={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</Text>
      </View>
      <Icon name="download" size={20} color="#64748b" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Project Details</Text>
        <TouchableOpacity>
          <Icon name="more-vert" size={24} color="#1e293b" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Project Info */}
        <View style={styles.section}>
          <View style={styles.projectHeader}>
            <Text style={styles.projectName}>{project.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(project.status) }]}>
              <Text style={styles.statusText}>{getStatusText(project.status)}</Text>
            </View>
          </View>
          
          <Text style={styles.projectDescription}>{project.description}</Text>
          
          <View style={styles.projectDetails}>
            <View style={styles.detailRow}>
              <Icon name="location-on" size={20} color="#64748b" />
              <Text style={styles.detailText}>{project.location}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Icon name="event" size={20} color="#64748b" />
              <Text style={styles.detailText}>
                Start: {new Date(project.startDate).toLocaleDateString()}
              </Text>
            </View>
            
            {project.endDate && (
              <View style={styles.detailRow}>
                <Icon name="event" size={20} color="#64748b" />
                <Text style={styles.detailText}>
                  End: {new Date(project.endDate).toLocaleDateString()}
                </Text>
              </View>
            )}
            
            {project.budget && (
              <View style={styles.detailRow}>
                <Icon name="attach-money" size={20} color="#64748b" />
                <Text style={styles.detailText}>
                  Budget: ${project.budget.toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Todos Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tasks</Text>
            <TouchableOpacity>
              <Icon name="add" size={24} color="#2563eb" />
            </TouchableOpacity>
          </View>
          
          {todos.length > 0 ? (
            todos.map(todo => (
              <TodoItem key={todo.id} todo={todo} />
            ))
          ) : (
            <Text style={styles.emptyText}>No tasks assigned</Text>
          )}
        </View>

        {/* Files Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Files</Text>
            <TouchableOpacity>
              <Icon name="add" size={24} color="#2563eb" />
            </TouchableOpacity>
          </View>
          
          {files.length > 0 ? (
            files.map(file => (
              <FileItem key={file.id} file={file} />
            ))
          ) : (
            <Text style={styles.emptyText}>No files uploaded</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  projectName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  projectDescription: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 24,
  },
  projectDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 16,
    color: '#64748b',
    marginLeft: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  todoItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  todoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  todoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  todoPriority: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 12,
  },
  todoPriorityText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  todoDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  todoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  todoAssignee: {
    fontSize: 12,
    color: '#64748b',
  },
  todoDueDate: {
    fontSize: 12,
    color: '#64748b',
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  fileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  fileSize: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ProjectDetailScreen; 