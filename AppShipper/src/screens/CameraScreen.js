import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, Camera as CameraIcon, Check, RotateCcw } from 'lucide-react-native';

export default function CameraScreen({ navigation, route }) {
  const { onPhotoTaken, orderId } = route.params;
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef(null);

  if (!permission) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#059669" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Cần cấp quyền truy cập Camera để chụp ảnh xác nhận.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Cấp quyền</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.btnCancel]} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleTakePicture = async () => {
    if (cameraRef.current) {
      setLoading(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5,
          skipProcessing: true,
        });
        setPhotoUri(photo.uri);
      } catch (err) {
        console.error("Camera error:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleConfirm = () => {
    if (onPhotoTaken && photoUri) {
      onPhotoTaken(photoUri);
      navigation.goBack();
    }
  };

  if (photoUri) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Xác nhận ảnh chụp</Text>
          <View style={{ width: 40 }} />
        </View>

        <Image source={{ uri: photoUri }} style={styles.previewImage} />

        <View style={styles.bottomControls}>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.btnRetry]} 
            onPress={() => setPhotoUri(null)}
          >
            <RotateCcw size={20} color="#fff" />
            <Text style={styles.actionBtnText}>Chụp lại</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionBtn, styles.btnConfirm]} 
            onPress={handleConfirm}
          >
            <Check size={20} color="#fff" />
            <Text style={styles.actionBtnText}>Xác nhận</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* CameraView NO LONGER supports children in Expo SDK 51+, put overlays sibling to it */}
      <CameraView style={styles.camera} facing={facing} ref={cameraRef} />

      <View style={[styles.headerOverlay, { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <X size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitleOverlay}>Chụp ảnh xác nhận đơn #{orderId}</Text>
        <TouchableOpacity onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')} style={styles.flipBtn}>
          <RotateCcw size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={[styles.shutterContainer, { position: 'absolute', bottom: 40, left: 0, right: 0, zIndex: 10 }]}>
        {loading ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : (
          <TouchableOpacity style={styles.shutterBtn} onPress={handleTakePicture}>
            <View style={styles.shutterInner} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#059669',
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 40,
    marginBottom: 10,
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: '#475569',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  camera: {
    flex: 1,
  },
  headerOverlay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingBottom: 15,
  },
  headerTitleOverlay: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  flipBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  shutterContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
    elevation: 10,
  },
  shutterBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    backgroundColor: '#000',
    paddingBottom: 15,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  previewImage: {
    flex: 1,
    resizeMode: 'contain',
  },
  bottomControls: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
    backgroundColor: '#000',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  btnRetry: {
    backgroundColor: '#334155',
  },
  btnConfirm: {
    backgroundColor: '#059669',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
