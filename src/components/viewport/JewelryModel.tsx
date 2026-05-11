import React, { useMemo, forwardRef } from 'react';
import { useLoader } from '@react-three/fiber';
import { STLLoader, OBJLoader } from 'three-stdlib';
import * as THREE from 'three';

export type MetalType = 'gold' | 'silver' | 'rose';

interface JewelryModelProps {
  url?: string;
  metalType: MetalType;
  fileName?: string;
  fileData?: ArrayBuffer;
  onPointerDown?: (event: any) => void;
}

const METAL_PROPS = {
  gold: {
    color: '#fcc201',
    metalness: 1,
    roughness: 0.1,
    emissive: '#443300',
    emissiveIntensity: 0.1,
  },
  silver: {
    color: '#e5e5e5',
    metalness: 1,
    roughness: 0.05,
    emissive: '#222222',
    emissiveIntensity: 0.05,
  },
  rose: {
    color: '#f4c2c2',
    metalness: 1,
    roughness: 0.15,
    emissive: '#442222',
    emissiveIntensity: 0.1,
  }
};

const JewelryModel = forwardRef<THREE.Mesh, JewelryModelProps>(({ url, metalType, fileName, onPointerDown }, ref) => {
  const isObj = url?.toLowerCase().split('?')[0].endsWith('.obj') || (fileName && fileName.toLowerCase().endsWith('.obj'));
  const result = useLoader(isObj ? OBJLoader : STLLoader, url!);
  
  // OBJLoader returns a Group, STLLoader returns a BufferGeometry
  const geometry = useMemo(() => {
    let geo: THREE.BufferGeometry | undefined;
    if (isObj) {
      const group = result as THREE.Group;
      // Find the first mesh in the group and get its geometry
      group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && !geo) {
          geo = (child as THREE.Mesh).geometry;
        }
      });
    } else {
      geo = result as THREE.BufferGeometry;
    }
    
    if (geo) {
      geo.computeBoundingBox();
      geo.center();
    }
    return geo;
  }, [result, isObj]);

  if (!geometry) return null;

  const props = METAL_PROPS[metalType];

  return (
    <mesh 
      ref={ref}
      geometry={geometry} 
      castShadow 
      receiveShadow
      onPointerDown={onPointerDown}
    >
      <meshStandardMaterial 
        {...props}
        envMapIntensity={1.5}
      />
    </mesh>
  );
});

JewelryModel.displayName = 'JewelryModel';

export const JewelryModelFromData = forwardRef<THREE.Mesh, { data: ArrayBuffer; metalType: MetalType; isObj: boolean; onPointerDown?: (event: any) => void }>(({ data, metalType, isObj, onPointerDown }, ref) => {
  const geometry = useMemo(() => {
    if (isObj) {
      const loader = new OBJLoader();
      const text = new TextDecoder().decode(data);
      const group = loader.parse(text);
      let geo: THREE.BufferGeometry | undefined;
      group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && !geo) {
          geo = (child as THREE.Mesh).geometry;
        }
      });
      if (geo) {
        geo.computeBoundingBox();
        geo.center();
      }
      return geo;
    } else {
      const loader = new STLLoader();
      const header = new TextDecoder().decode(data.slice(0, 500));
      let geo: THREE.BufferGeometry;
      // ASCII STL files contain 'facet normal'
      if (header.includes('facet normal') || header.trim().startsWith('solid')) {
        const text = new TextDecoder().decode(data);
        geo = loader.parse(text) as THREE.BufferGeometry;
      } else {
        geo = loader.parse(data) as THREE.BufferGeometry;
      }
      geo.computeBoundingBox();
      geo.center();
      return geo;
    }
  }, [data, isObj]);

  if (!geometry) return null;

  const props = METAL_PROPS[metalType];

  return (
    <mesh 
      ref={ref}
      geometry={geometry} 
      castShadow 
      receiveShadow
      onPointerDown={onPointerDown}
    >
      <meshStandardMaterial 
        {...props}
        envMapIntensity={1.5}
      />
    </mesh>
  );
});

JewelryModelFromData.displayName = 'JewelryModelFromData';

export default JewelryModel;
