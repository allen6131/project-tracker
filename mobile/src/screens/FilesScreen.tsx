import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { filesAPI, projectsAPI } from '../services/api';
import { ProjectFile, Project } from '../types';

const FilesScreen: React.FC = () => {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<ProjectFile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');

  const fetchData = async () => {
    try {
      const [projectsData, filesData] = await Promise.all([
        projectsAPI.getProjects(),
        filesAPI.getAllFiles(), // Assuming we have an endpoint to get all files
      ]);
      
      setProjects(projectsData);
      setFiles(filesData);
      setFilteredFiles(filesData);
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load files');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    let filtered = files;
    
    // Filter by project
    if (selectedProject !== 'all') {
      filtered = filtered.filter(file => file.projectId.toString() === selectedProject);
    }
    
    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(file =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.type.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    setFilteredFiles(filtered);
  }, [searchQuery, selectedProject, files]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getFileIcon = (type: string) => {
    const fileType = type.toLowerCase();
    if (fileType.includes('pdf')) return 'picture-as-pdf';
    if (fileType.includes('image')) return 'image';
    if (fileType.includes('video')) return 'videocam';
    if (fileType.includes('audio')) return 'audiotrack';
    if (fileType.includes('word') || fileType.includes('doc')) return 'description';
    if (fileType.includes('excel') || fileType.includes('sheet')) return 'grid-on';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'slideshow';
    return 'insert-drive-file';
  };

  const getFileIconColor = (type: string) => {
    const fileType = type.toLowerCase();
    if (fileType.includes('pdf')) return '#dc2626';
    if (fileType.includes('image')) return '#16a34a';
    if (fileType.includes('video')) return '#2563eb';
    if (fileType.includes('audio')) return '#7c3aed';
    if (fileType.includes('word') || fileType.includes('doc')) return '#2563eb';
    if (fileType.includes('excel') || fileType.includes('sheet')) return '#16a34a';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '#ea580c';
    return '#64748b';
  };

  const handleFileDownload = async (file: ProjectFile) => {
    try {
      await filesAPI.downloadFile(file.id);
      Alert.alert('Success', 'File downloaded successfully');
    } catch (error) {
      console.error('Error downloading file:', error);
      Alert.alert('Error', 'Failed to download file');
    }
  };

  const renderFile = ({ item }: { item: ProjectFile }) => {
    const project = projects.find(p => p.id === item.projectId);
    
    return (
      <TouchableOpacity 
        style={styles.fileCard}
        onPress={() => handleFileDownload(item)}
      >
        <View style={styles.fileHeader}>
          <Icon 
            name={getFileIcon(item.type)} 
            size={32} 
            color={getFileIconColor(item.type)} 
          />
          <View style={styles.fileInfo}>
            <Text style={styles.fileName}>{item.name}</Text>
            <Text style={styles.fileType}>{item.type}</Text>
          </View>
          <View style={styles.fileActions}>
            <TouchableOpacity onPress={() => handleFileDownload(item)}>
              <Icon name="download" size={20} color="#2563eb" />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.fileDetails}>
          <View style={styles.detailRow}>
            <Icon name="work" size={16} color="#64748b" />
            <Text style={styles.detailText}>{project?.name || 'Unknown Project'}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Icon name="data-usage" size={16} color="#64748b" />
            <Text style={styles.detailText}>{(item.size / 1024).toFixed(1)} KB</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Icon name="event" size={16} color="#64748b" />
            <Text style={styles.detailText}>
              {new Date(item.uploadedAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const ProjectFilter = () => (
    <View style={styles.filterContainer}>
      <Text style={styles.filterLabel}>Project:</Text>
      <FlatList
        horizontal
        data={[{ id: 'all', name: 'All Projects' }, ...projects]}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedProject === item.id.toString() && styles.filterButtonActive
            ]}
            onPress={() => setSelectedProject(item.id.toString())}
          >
            <Text style={[
              styles.filterButtonText,
              selectedProject === item.id.toString() && styles.filterButtonTextActive
            ]}>
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id.toString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Files</Text>
        <TouchableOpacity style={styles.addButton}>
          <Icon name="add" size={24} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#64748b" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search files..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Project Filter */}
      <ProjectFilter />

      {/* Files List */}
      <FlatList
        data={filteredFiles}
        renderItem={renderFile}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="folder" size={48} color="#94a3b8" />
            <Text style={styles.emptyText}>No files found</Text>
          </View>
        }
      />
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  addButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  filterList: {
    paddingRight: 20,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  listContainer: {
    padding: 20,
  },
  fileCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  fileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fileName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  fileType: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  fileActions: {
    flexDirection: 'row',
    gap: 8,
  },
  fileDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 12,
  },
});

export default FilesScreen; 