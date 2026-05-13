import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createIcons, icons } from 'lucide';

const GRID_SIZE = 96;
const HALF_GRID = GRID_SIZE / 2;
const MAX_HEIGHT = 30;
const MIN_HEIGHT = -2;
const STORAGE_KEY = 'cozy-blocks-city-v1';
const SVG_NS = 'http://www.w3.org/2000/svg';
const MUSIC_TRACKS = ['/audio/midnight-study-1.mp3', '/audio/midnight-study-2.mp3'] as const;
const EXPLORE_SPAWN = { x: 48, z: 32 };
const EXPLORE_AVATAR_RADIUS = 0.42;
const EXPLORE_WALK_SPEED = 8.4;
const EXPLORE_RUN_MULTIPLIER = 1.55;
const EXPLORE_CAMERA_MIN_DISTANCE = 7;
const EXPLORE_CAMERA_MAX_DISTANCE = 18;
const EXPLORE_CAMERA_MIN_PITCH = 0.22;
const EXPLORE_CAMERA_MAX_PITCH = 0.86;

type VoxelType =
  | 'pavement'
  | 'road'
  | 'water'
  | 'soil'
  | 'grass'
  | 'brick'
  | 'stone'
  | 'roof'
  | 'glass'
  | 'window'
  | 'iron'
  | 'bus'
  | 'cab'
  | 'landmark'
  | 'lamp'
  | 'underground'
  | 'wood'
  | 'leaf'
  | 'sakura';

type Tool = 'paint' | 'erase' | 'sample' | 'stamp' | 'pan' | 'orbit' | 'zoom' | 'explore';

type Voxel = {
  x: number;
  y: number;
  z: number;
  type: VoxelType;
};

type VoxelSnapshot = Array<[string, VoxelType]>;

type CityFile = {
  version: 1;
  gridSize: number;
  voxels: Voxel[];
};

type BlockInfo = {
  label: string;
  color: number;
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
};

type PresetTheme = 'london' | 'japanese';
type PresetRotation = 0 | 1 | 2 | 3;

type PresetVoxel = {
  dx: number;
  dy: number;
  dz: number;
  type: VoxelType;
};

type ObjectPreset = {
  id: string;
  theme: PresetTheme;
  category: string;
  label: string;
  swatches: VoxelType[];
  voxels: PresetVoxel[];
};

type CatalogCategory = 'terrain' | 'nature' | 'structures' | 'decor' | 'utility';

type CatalogItem = {
  id: string;
  category: CatalogCategory;
  kind: 'block' | 'preset';
  label: string;
  swatches: VoxelType[];
  blockType?: VoxelType;
  presetId?: string;
};

const BLOCKS: Record<VoxelType, BlockInfo> = {
  pavement: { label: 'Pavement', color: 0xb9b6ac, roughness: 0.92 },
  road: { label: 'Road', color: 0x2e3439, roughness: 0.86 },
  water: { label: 'Thames water', color: 0x2d6f90, roughness: 0.44, transparent: true, opacity: 0.82 },
  soil: { label: 'Brown soil', color: 0x8a5a33, roughness: 0.94 },
  grass: { label: 'Park grass', color: 0x548b4a, roughness: 0.88 },
  brick: { label: 'London brick', color: 0xa44a3a, roughness: 0.9 },
  stone: { label: 'Portland stone', color: 0xd3c4aa, roughness: 0.82 },
  roof: { label: 'Slate roof', color: 0x3d4552, roughness: 0.76 },
  glass: { label: 'Blue glass', color: 0x78b3d6, roughness: 0.28, metalness: 0.04 },
  window: { label: 'Lit window', color: 0xffc76d, roughness: 0.32, metalness: 0.02, transparent: true, opacity: 0.92 },
  iron: { label: 'Ironwork', color: 0x56616a, roughness: 0.58, metalness: 0.34 },
  bus: { label: 'Red bus', color: 0xc72222, roughness: 0.5 },
  cab: { label: 'Black cab', color: 0x11100f, roughness: 0.4 },
  landmark: { label: 'Clock gold', color: 0xc9a85c, roughness: 0.48, metalness: 0.16 },
  lamp: { label: 'Street lamp', color: 0xf3d268, roughness: 0.42, metalness: 0.08 },
  underground: { label: 'Underground blue', color: 0x1f4e9f, roughness: 0.52 },
  wood: { label: 'Plane tree trunk', color: 0x7a5135, roughness: 0.84 },
  leaf: { label: 'Plane tree leaf', color: 0x2f7a4e, roughness: 0.9 },
  sakura: { label: 'Sakura blossom', color: 0xef92b7, roughness: 0.86 },
};

const PALETTE_ORDER: VoxelType[] = [
  'brick',
  'stone',
  'roof',
  'glass',
  'window',
  'pavement',
  'road',
  'water',
  'soil',
  'grass',
  'bus',
  'cab',
  'landmark',
  'lamp',
  'underground',
  'iron',
  'wood',
  'leaf',
  'sakura',
];

const PRESET_THEMES: Array<{ id: PresetTheme; label: string }> = [
  { id: 'london', label: 'London' },
  { id: 'japanese', label: 'Japanese' },
];

const CATALOG_CATEGORIES: Array<{ id: CatalogCategory; label: string }> = [
  { id: 'terrain', label: 'Terrain' },
  { id: 'nature', label: 'Nature' },
  { id: 'structures', label: 'Structures' },
  { id: 'decor', label: 'Decor' },
  { id: 'utility', label: 'Utility' },
];

const BLOCK_CATALOG: CatalogItem[] = [
  blockCatalogItem('grass', 'terrain', 'Grass'),
  blockCatalogItem('pavement', 'terrain', 'Path'),
  blockCatalogItem('road', 'terrain', 'Road'),
  blockCatalogItem('water', 'terrain', 'Water'),
  blockCatalogItem('soil', 'terrain', 'Soil'),
  blockCatalogItem('stone', 'terrain', 'Stone'),
  blockCatalogItem('brick', 'structures', 'Brick'),
  blockCatalogItem('roof', 'structures', 'Slate'),
  blockCatalogItem('glass', 'structures', 'Glass'),
  blockCatalogItem('window', 'structures', 'Lit Window'),
  blockCatalogItem('iron', 'decor', 'Iron'),
  blockCatalogItem('lamp', 'decor', 'Lantern'),
  blockCatalogItem('landmark', 'decor', 'Gold'),
  blockCatalogItem('underground', 'decor', 'Sign Blue'),
  blockCatalogItem('wood', 'nature', 'Wood'),
  blockCatalogItem('leaf', 'nature', 'Leaves'),
  blockCatalogItem('sakura', 'nature', 'Sakura'),
  blockCatalogItem('bus', 'utility', 'Red Paint'),
  blockCatalogItem('cab', 'utility', 'Black Paint'),
];

const OBJECT_PRESETS: ObjectPreset[] = [
  makePreset('london-bus', 'london', 'Transport', 'Double Decker Bus', ['bus', 'glass', 'cab'], [
    presetCuboid(0, 0, 0, 3, 2, 7, 'bus'),
    presetCuboid(0, 2, 0, 3, 2, 7, 'bus'),
    presetCuboid(0, 1, 1, 3, 1, 5, 'glass'),
    presetCuboid(0, 3, 1, 3, 1, 5, 'glass'),
    presetCuboid(1, 4, 0, 1, 1, 7, 'roof'),
    [
      presetVoxel(0, 0, 0, 'cab'),
      presetVoxel(2, 0, 0, 'cab'),
      presetVoxel(0, 0, 6, 'cab'),
      presetVoxel(2, 0, 6, 'cab'),
      presetVoxel(1, 2, 0, 'glass'),
      presetVoxel(1, 3, 6, 'glass'),
    ],
  ]),
  makePreset('london-cab', 'london', 'Transport', 'Black Cab', ['cab', 'glass', 'iron'], [
    presetCuboid(0, 0, 0, 3, 1, 5, 'cab'),
    presetCuboid(1, 1, 1, 1, 1, 3, 'cab'),
    presetCuboid(0, 1, 1, 3, 1, 1, 'glass'),
    presetCuboid(0, 1, 3, 3, 1, 1, 'glass'),
    [presetVoxel(0, 0, 0, 'iron'), presetVoxel(2, 0, 0, 'iron'), presetVoxel(0, 0, 4, 'iron'), presetVoxel(2, 0, 4, 'iron')],
  ]),
  makePreset('london-terrace', 'london', 'Buildings', 'Terrace House', ['brick', 'stone', 'roof', 'window'], [
    presetCuboid(0, 0, 0, 8, 1, 7, 'stone'),
    presetCuboid(1, 1, 1, 6, 5, 5, 'brick'),
    presetCuboid(0, 6, 0, 8, 1, 7, 'roof'),
    presetCuboid(1, 7, 1, 6, 1, 5, 'roof'),
    presetCuboid(3, 8, 1, 2, 1, 5, 'roof'),
    presetCuboid(2, 1, 0, 2, 1, 1, 'stone'),
    presetCuboid(3, 2, 0, 1, 2, 1, 'cab'),
    presetWindows(1, 3, 1, 6, 5, 'window'),
    presetWindows(1, 5, 1, 6, 5, 'window'),
    [
      presetVoxel(1, 8, 2, 'brick'),
      presetVoxel(1, 9, 2, 'brick'),
      presetVoxel(6, 8, 4, 'brick'),
      presetVoxel(6, 9, 4, 'brick'),
    ],
  ]),
  makePreset('london-clock-tower', 'london', 'Landmarks', 'Clock Tower', ['stone', 'landmark', 'roof'], [
    presetCuboid(0, 0, 0, 5, 2, 5, 'stone'),
    presetCuboid(1, 2, 1, 3, 12, 3, 'stone'),
    presetCuboid(0, 14, 0, 5, 2, 5, 'stone'),
    presetCuboid(1, 16, 1, 3, 1, 3, 'landmark'),
    presetSteppedRoof(0, 17, 0, 5, 5, 3, 'roof'),
    [
      presetVoxel(2, 12, 0, 'landmark'),
      presetVoxel(2, 12, 4, 'landmark'),
      presetVoxel(0, 12, 2, 'landmark'),
      presetVoxel(4, 12, 2, 'landmark'),
      presetVoxel(2, 20, 2, 'landmark'),
      presetVoxel(2, 21, 2, 'roof'),
    ],
  ]),
  makePreset('london-tower-bridge', 'london', 'Landmarks', 'Bridge Pier', ['stone', 'road', 'iron'], [
    presetCuboid(0, 0, 0, 3, 8, 4, 'stone'),
    presetCuboid(9, 0, 0, 3, 8, 4, 'stone'),
    presetCuboid(0, 8, 0, 3, 2, 4, 'roof'),
    presetCuboid(9, 8, 0, 3, 2, 4, 'roof'),
    presetCuboid(0, 4, 1, 12, 1, 2, 'road'),
    presetCuboid(1, 7, 1, 10, 1, 1, 'iron'),
    presetCuboid(1, 7, 2, 10, 1, 1, 'iron'),
    [
      presetVoxel(3, 5, 1, 'iron'),
      presetVoxel(4, 6, 1, 'iron'),
      presetVoxel(5, 6, 1, 'iron'),
      presetVoxel(6, 6, 2, 'iron'),
      presetVoxel(7, 6, 2, 'iron'),
      presetVoxel(8, 5, 2, 'iron'),
      presetVoxel(1, 10, 1, 'landmark'),
      presetVoxel(10, 10, 2, 'landmark'),
    ],
  ]),
  makePreset('london-underground', 'london', 'Street Props', 'Underground Sign', ['bus', 'underground', 'iron'], [
    presetCuboid(2, 0, 1, 1, 4, 1, 'iron'),
    [
      presetVoxel(0, 4, 1, 'bus'),
      presetVoxel(1, 4, 1, 'underground'),
      presetVoxel(2, 4, 1, 'underground'),
      presetVoxel(3, 4, 1, 'underground'),
      presetVoxel(4, 4, 1, 'bus'),
      presetVoxel(2, 5, 1, 'bus'),
      presetVoxel(2, 3, 1, 'bus'),
    ],
  ]),
  makePreset('london-lamp', 'london', 'Street Props', 'Street Lamp', ['iron', 'lamp'], [
    presetCuboid(0, 0, 0, 1, 5, 1, 'iron'),
    presetCuboid(0, 4, 0, 3, 1, 1, 'iron'),
    [presetVoxel(2, 3, 0, 'lamp'), presetVoxel(2, 2, 0, 'lamp'), presetVoxel(0, 5, 0, 'iron')],
  ]),
  makePreset('london-tree', 'london', 'Vegetation', 'Plane Tree', ['wood', 'leaf'], [
    presetCuboid(3, 0, 3, 2, 5, 2, 'wood'),
    presetCuboid(2, 4, 3, 1, 1, 1, 'wood'),
    presetCuboid(5, 4, 4, 1, 1, 1, 'wood'),
    presetCanopy(4, 4, 4, 4, 4, 4, 'leaf'),
    presetCanopy(2, 5, 3, 2, 2, 2, 'leaf'),
    presetCanopy(6, 5, 5, 2, 2, 2, 'leaf'),
  ]),
  makePreset('london-kiosk', 'london', 'Street Props', 'Red Kiosk', ['bus', 'window', 'roof'], [
    presetCuboid(0, 0, 0, 3, 5, 3, 'bus'),
    presetCuboid(0, 5, 0, 3, 1, 3, 'roof'),
    presetCuboid(1, 6, 1, 1, 1, 1, 'roof'),
    [
      presetVoxel(0, 2, 1, 'window'),
      presetVoxel(2, 2, 1, 'window'),
      presetVoxel(1, 2, 0, 'window'),
      presetVoxel(1, 3, 0, 'window'),
      presetVoxel(1, 0, 0, 'cab'),
    ],
  ]),
  makePreset('japan-sakura-tree', 'japanese', 'Vegetation', 'Sakura Tree', ['wood', 'sakura', 'leaf'], [
    presetCuboid(3, 0, 3, 2, 5, 2, 'wood'),
    presetCuboid(2, 4, 3, 1, 1, 1, 'wood'),
    presetCuboid(5, 4, 4, 1, 1, 1, 'wood'),
    presetCanopy(4, 4, 4, 4, 4, 4, 'sakura'),
    presetCanopy(2, 5, 3, 2, 2, 2, 'sakura'),
    presetCanopy(6, 5, 5, 2, 2, 2, 'sakura'),
    [presetVoxel(2, 3, 6, 'leaf'), presetVoxel(6, 4, 2, 'leaf')],
  ]),
  makePreset('japan-bamboo', 'japanese', 'Vegetation', 'Bamboo Cluster', ['leaf', 'grass', 'wood'], [
    presetPosts([[0, 0], [2, 0], [4, 1], [1, 3], [3, 3]], 0, 6, 'leaf'),
    [presetVoxel(0, 6, 0, 'grass'), presetVoxel(2, 6, 0, 'grass'), presetVoxel(4, 7, 1, 'grass'), presetVoxel(1, 5, 3, 'grass'), presetVoxel(3, 6, 3, 'grass')],
  ]),
  makePreset('japan-torii', 'japanese', 'Shrines', 'Torii Gate', ['bus', 'roof', 'lamp'], [
    presetCuboid(0, 0, 0, 2, 1, 2, 'stone'),
    presetCuboid(6, 0, 0, 2, 1, 2, 'stone'),
    presetCuboid(0, 1, 0, 1, 6, 1, 'bus'),
    presetCuboid(7, 1, 0, 1, 6, 1, 'bus'),
    presetCuboid(1, 5, 0, 6, 1, 1, 'bus'),
    presetCuboid(0, 7, 0, 8, 1, 1, 'bus'),
    presetCuboid(0, 8, 0, 8, 1, 1, 'roof'),
    [presetVoxel(1, 3, 0, 'bus'), presetVoxel(2, 3, 0, 'bus'), presetVoxel(5, 3, 0, 'bus'), presetVoxel(6, 3, 0, 'bus'), presetVoxel(0, 0, 2, 'lamp'), presetVoxel(7, 0, 2, 'lamp')],
  ]),
  makePreset('japan-stone-lantern', 'japanese', 'Lighting', 'Stone Lantern', ['stone', 'lamp', 'roof'], [
    presetCuboid(0, 0, 0, 3, 1, 3, 'stone'),
    presetCuboid(1, 1, 1, 1, 3, 1, 'stone'),
    presetCuboid(0, 4, 0, 3, 1, 3, 'stone'),
    presetCuboid(0, 5, 0, 3, 1, 3, 'roof'),
    [presetVoxel(1, 5, 1, 'lamp'), presetVoxel(1, 6, 1, 'roof'), presetVoxel(1, 7, 1, 'stone')],
  ]),
  makePreset('japan-shrine-box', 'japanese', 'Shrines', 'Shrine Box', ['stone', 'bus', 'roof', 'lamp'], [
    presetCuboid(0, 0, 0, 7, 1, 6, 'stone'),
    presetCuboid(1, 1, 1, 5, 1, 4, 'stone'),
    presetCuboid(1, 2, 1, 5, 3, 4, 'bus'),
    presetWindows(1, 3, 1, 5, 4, 'lamp'),
    presetCuboid(0, 5, 0, 7, 1, 6, 'roof'),
    presetCuboid(1, 6, 1, 5, 1, 4, 'roof'),
    presetCuboid(3, 7, 2, 1, 1, 2, 'landmark'),
    [presetVoxel(3, 2, 0, 'stone'), presetVoxel(3, 3, 0, 'cab'), presetVoxel(0, 1, 5, 'lamp'), presetVoxel(6, 1, 5, 'lamp')],
  ]),
  makePreset('japan-bridge', 'japanese', 'Water Features', 'Small Bridge', ['wood', 'water', 'stone'], [
    presetCuboid(0, 0, 1, 9, 1, 3, 'wood'),
    presetCuboid(0, 1, 0, 1, 2, 5, 'wood'),
    presetCuboid(8, 1, 0, 1, 2, 5, 'wood'),
    presetCuboid(1, 2, 0, 7, 1, 1, 'wood'),
    presetCuboid(1, 2, 4, 7, 1, 1, 'wood'),
    [presetVoxel(2, 1, 2, 'wood'), presetVoxel(3, 2, 2, 'wood'), presetVoxel(4, 3, 2, 'wood'), presetVoxel(5, 2, 2, 'wood'), presetVoxel(6, 1, 2, 'wood')],
  ]),
  makePreset('japan-rice-paddy', 'japanese', 'Water Features', 'Rice Paddy', ['water', 'grass', 'wood'], [
    presetFrame(0, 0, 0, 7, 6, 'wood'),
    presetCuboid(1, 0, 1, 5, 1, 4, 'water'),
    [
      presetVoxel(1, 1, 1, 'grass'),
      presetVoxel(3, 1, 1, 'grass'),
      presetVoxel(5, 1, 1, 'grass'),
      presetVoxel(2, 1, 3, 'grass'),
      presetVoxel(4, 1, 3, 'grass'),
      presetVoxel(5, 1, 4, 'grass'),
    ],
  ]),
  makePreset('japan-fence', 'japanese', 'Borders', 'Wood Fence', ['wood', 'stone'], [
    presetPosts([[0, 0], [2, 0], [4, 0], [6, 0]], 0, 3, 'wood'),
    presetCuboid(0, 1, 0, 7, 1, 1, 'wood'),
    presetCuboid(0, 2, 0, 7, 1, 1, 'wood'),
    [presetVoxel(0, 3, 0, 'stone'), presetVoxel(6, 3, 0, 'stone')],
  ]),
  makePreset('japan-pagoda', 'japanese', 'Buildings', 'Pagoda', ['stone', 'bus', 'roof', 'landmark'], [
    presetCuboid(0, 0, 0, 9, 1, 9, 'stone'),
    presetCuboid(1, 1, 1, 7, 2, 7, 'stone'),
    presetCuboid(2, 2, 2, 5, 3, 5, 'bus'),
    presetWindows(2, 3, 2, 5, 5, 'lamp'),
    presetCuboid(0, 5, 0, 9, 1, 9, 'roof'),
    presetCuboid(1, 6, 1, 7, 1, 7, 'roof'),
    presetCuboid(3, 7, 3, 3, 3, 3, 'bus'),
    presetWindows(3, 8, 3, 3, 3, 'lamp'),
    presetCuboid(1, 10, 1, 7, 1, 7, 'roof'),
    presetCuboid(2, 11, 2, 5, 1, 5, 'roof'),
    presetCuboid(3, 12, 3, 3, 2, 3, 'bus'),
    presetCuboid(2, 14, 2, 5, 1, 5, 'roof'),
    presetCuboid(3, 15, 3, 3, 1, 3, 'roof'),
    [presetVoxel(4, 16, 4, 'landmark'), presetVoxel(4, 17, 4, 'landmark'), presetVoxel(4, 18, 4, 'roof')],
  ]),
  makePreset('japan-well', 'japanese', 'Utilities', 'Well', ['stone', 'water', 'wood', 'roof'], [
    presetFrame(0, 0, 0, 5, 5, 'stone'),
    presetCuboid(1, 0, 1, 3, 1, 3, 'water'),
    presetPosts([[0, 0], [4, 0], [0, 4], [4, 4]], 1, 3, 'wood'),
    presetCuboid(0, 4, 0, 5, 1, 5, 'roof'),
    presetCuboid(1, 5, 1, 3, 1, 3, 'roof'),
  ]),
  makePreset('london-st-pauls-grand', 'london', 'Landmarks', "St Paul's Cathedral", ['stone', 'roof', 'landmark', 'window'], [
    presetCuboid(0, 0, 0, 19, 1, 15, 'stone'),
    presetSteps(4, 1, 0, 11, 4, 'stone'),
    presetCuboid(2, 1, 3, 15, 5, 9, 'stone'),
    presetCuboid(7, 1, 1, 5, 5, 13, 'stone'),
    presetPosts([[1, 12], [4, 12], [7, 12], [11, 12], [14, 12], [17, 12]], 1, 4, 'stone'),
    presetWindows(2, 3, 3, 15, 9, 'window'),
    presetWindows(7, 4, 1, 5, 13, 'window'),
    presetCuboid(1, 6, 2, 17, 1, 11, 'roof'),
    presetCuboid(3, 7, 3, 13, 1, 9, 'roof'),
    presetCuboid(5, 8, 5, 9, 1, 5, 'stone'),
    presetDome(9, 9, 7, 5, 4, 5, 'stone'),
    presetCuboid(8, 14, 6, 3, 1, 3, 'stone'),
    presetCuboid(9, 15, 7, 1, 3, 1, 'landmark'),
    presetCuboid(1, 1, 1, 3, 8, 3, 'stone'),
    presetCuboid(15, 1, 1, 3, 8, 3, 'stone'),
    presetSteppedRoof(0, 9, 0, 5, 5, 3, 'roof'),
    presetSteppedRoof(14, 9, 0, 5, 5, 3, 'roof'),
    [
      presetVoxel(2, 12, 2, 'landmark'),
      presetVoxel(16, 12, 2, 'landmark'),
      presetVoxel(9, 18, 7, 'lamp'),
      presetVoxel(5, 2, 0, 'window'),
      presetVoxel(13, 2, 0, 'window'),
    ],
  ]),
  makePreset('london-shard-grand', 'london', 'Landmarks', 'The Shard', ['glass', 'iron', 'stone', 'roof'], [
    presetCuboid(1, 0, 1, 11, 1, 11, 'stone'),
    presetCuboid(3, 1, 3, 7, 1, 7, 'glass'),
    presetTaperedTower(6, 2, 6, 6, 25, 'glass'),
    presetLine(6, 2, 1, 6, 24, 5, 'iron'),
    presetLine(6, 2, 11, 6, 24, 7, 'iron'),
    presetLine(1, 2, 6, 5, 22, 6, 'iron'),
    presetLine(11, 2, 6, 7, 22, 6, 'iron'),
    presetCuboid(5, 26, 5, 3, 1, 3, 'glass'),
    presetCuboid(6, 27, 6, 1, 3, 1, 'roof'),
    [presetVoxel(6, 30, 6, 'glass'), presetVoxel(5, 2, 1, 'lamp'), presetVoxel(7, 2, 11, 'lamp')],
  ]),
  makePreset('london-eye-grand', 'london', 'Landmarks', 'London Eye', ['iron', 'glass', 'lamp', 'stone'], [
    presetCuboid(0, 0, 0, 17, 1, 6, 'pavement'),
    presetCuboid(6, 1, 1, 5, 1, 4, 'stone'),
    presetWheel(8, 10, 3, 8, 'iron', 'glass'),
    presetLine(2, 1, 2, 8, 10, 3, 'iron'),
    presetLine(14, 1, 2, 8, 10, 3, 'iron'),
    presetLine(2, 1, 4, 8, 10, 3, 'iron'),
    presetLine(14, 1, 4, 8, 10, 3, 'iron'),
    presetCuboid(7, 1, 3, 3, 2, 1, 'iron'),
    [
      presetVoxel(8, 10, 3, 'lamp'),
      presetVoxel(8, 18, 3, 'lamp'),
      presetVoxel(8, 2, 3, 'lamp'),
      presetVoxel(0, 10, 3, 'glass'),
      presetVoxel(16, 10, 3, 'glass'),
    ],
  ]),
  makePreset('london-parliament-grand', 'london', 'Landmarks', 'Parliament Wing', ['stone', 'roof', 'landmark', 'window'], [
    presetCuboid(0, 0, 0, 24, 1, 11, 'stone'),
    presetCuboid(1, 1, 1, 22, 5, 9, 'stone'),
    presetWindows(1, 2, 1, 22, 9, 'window'),
    presetWindows(1, 4, 1, 22, 9, 'window'),
    presetCuboid(0, 6, 0, 24, 1, 11, 'roof'),
    presetCuboid(2, 7, 1, 20, 1, 9, 'roof'),
    presetCuboid(0, 1, 0, 4, 9, 4, 'stone'),
    presetCuboid(10, 1, 0, 4, 8, 4, 'stone'),
    presetCuboid(20, 1, 0, 4, 14, 4, 'stone'),
    presetSteppedRoof(0, 10, 0, 4, 4, 3, 'roof'),
    presetSteppedRoof(10, 9, 0, 4, 4, 3, 'roof'),
    presetSteppedRoof(19, 15, 0, 6, 6, 4, 'roof'),
    presetCuboid(21, 11, 0, 2, 2, 1, 'landmark'),
    presetCuboid(21, 11, 3, 2, 2, 1, 'landmark'),
    [
      presetVoxel(2, 13, 2, 'landmark'),
      presetVoxel(12, 12, 2, 'landmark'),
      presetVoxel(22, 19, 2, 'landmark'),
      presetVoxel(22, 20, 2, 'roof'),
    ],
  ]),
  makePreset('japan-grand-temple', 'japanese', 'Buildings', 'Grand Temple', ['stone', 'wood', 'roof', 'bus', 'lamp'], [
    presetCuboid(0, 0, 0, 21, 1, 17, 'stone'),
    presetSteps(7, 1, 0, 7, 4, 'stone'),
    presetCuboid(3, 1, 4, 15, 1, 10, 'stone'),
    presetCuboid(4, 2, 5, 13, 4, 8, 'bus'),
    presetPosts([[3, 4], [6, 4], [10, 4], [14, 4], [17, 4], [3, 13], [6, 13], [10, 13], [14, 13], [17, 13]], 2, 5, 'wood'),
    presetWindows(4, 3, 5, 13, 8, 'lamp'),
    presetCuboid(1, 6, 2, 19, 1, 14, 'roof'),
    presetCuboid(2, 7, 3, 17, 1, 12, 'roof'),
    presetCuboid(4, 8, 5, 13, 1, 8, 'roof'),
    presetCuboid(6, 9, 6, 9, 3, 5, 'bus'),
    presetWindows(6, 10, 6, 9, 5, 'lamp'),
    presetCuboid(4, 12, 4, 13, 1, 9, 'roof'),
    presetCuboid(5, 13, 5, 11, 1, 7, 'roof'),
    presetCuboid(8, 14, 7, 5, 1, 3, 'roof'),
    [
      presetVoxel(10, 15, 8, 'landmark'),
      presetVoxel(10, 16, 8, 'landmark'),
      presetVoxel(2, 2, 2, 'lamp'),
      presetVoxel(18, 2, 2, 'lamp'),
      presetVoxel(2, 2, 15, 'lamp'),
      presetVoxel(18, 2, 15, 'lamp'),
    ],
  ]),
  makePreset('japan-castle-keep', 'japanese', 'Buildings', 'Castle Keep', ['stone', 'roof', 'window', 'landmark'], [
    presetCuboid(0, 0, 0, 17, 2, 17, 'stone'),
    presetSteps(6, 2, 0, 5, 4, 'stone'),
    presetCuboid(2, 2, 2, 13, 5, 13, 'stone'),
    presetWindows(2, 4, 2, 13, 13, 'window'),
    presetCuboid(0, 7, 0, 17, 1, 17, 'roof'),
    presetCuboid(1, 8, 1, 15, 1, 15, 'roof'),
    presetCuboid(4, 9, 4, 9, 5, 9, 'stone'),
    presetWindows(4, 11, 4, 9, 9, 'window'),
    presetCuboid(2, 14, 2, 13, 1, 13, 'roof'),
    presetCuboid(3, 15, 3, 11, 1, 11, 'roof'),
    presetCuboid(6, 16, 6, 5, 4, 5, 'stone'),
    presetWindows(6, 18, 6, 5, 5, 'window'),
    presetCuboid(4, 20, 4, 9, 1, 9, 'roof'),
    presetCuboid(5, 21, 5, 7, 1, 7, 'roof'),
    presetCuboid(7, 22, 7, 3, 1, 3, 'roof'),
    [
      presetVoxel(8, 23, 8, 'landmark'),
      presetVoxel(8, 24, 8, 'landmark'),
      presetVoxel(2, 8, 2, 'landmark'),
      presetVoxel(14, 8, 2, 'landmark'),
      presetVoxel(2, 8, 14, 'landmark'),
      presetVoxel(14, 8, 14, 'landmark'),
    ],
  ]),
  makePreset('japan-shrine-courtyard', 'japanese', 'Shrines', 'Shrine Courtyard', ['bus', 'pavement', 'wood', 'lamp', 'roof'], [
    presetCuboid(0, 0, 0, 21, 1, 21, 'grass'),
    presetWallRun(0, 1, 0, 21, 21, 2, 'wood'),
    presetCuboid(9, 1, 0, 3, 1, 21, 'pavement'),
    presetCuboid(0, 1, 9, 21, 1, 3, 'pavement'),
    presetCuboid(1, 1, 1, 4, 1, 4, 'sakura'),
    presetCuboid(16, 1, 1, 4, 1, 4, 'sakura'),
    presetCuboid(6, 2, 16, 9, 4, 4, 'bus'),
    presetCuboid(5, 6, 15, 11, 1, 6, 'roof'),
    presetCuboid(6, 7, 16, 9, 1, 4, 'roof'),
    presetCuboid(8, 0, 0, 1, 6, 1, 'bus'),
    presetCuboid(12, 0, 0, 1, 6, 1, 'bus'),
    presetCuboid(8, 5, 0, 5, 1, 1, 'bus'),
    presetCuboid(7, 7, 0, 7, 1, 1, 'roof'),
    presetPosts([[3, 8], [17, 8], [3, 13], [17, 13], [8, 3], [12, 3]], 1, 3, 'lamp'),
    [
      presetVoxel(10, 2, 20, 'landmark'),
      presetVoxel(10, 8, 18, 'landmark'),
      presetVoxel(7, 0, 0, 'stone'),
      presetVoxel(13, 0, 0, 'stone'),
    ],
  ]),
  makePreset('japan-garden-pond', 'japanese', 'Water Features', 'Garden Pond', ['water', 'stone', 'leaf', 'wood', 'sakura'], [
    presetCuboid(0, 0, 0, 17, 1, 15, 'grass'),
    presetEllipse(8, 1, 7, 6, 4, 'water'),
    presetEllipse(8, 2, 7, 7, 5, 'stone'),
    presetEllipse(8, 3, 7, 5, 3, 'water'),
    presetCuboid(3, 4, 6, 11, 1, 2, 'wood'),
    presetCuboid(3, 5, 5, 1, 2, 4, 'wood'),
    presetCuboid(13, 5, 5, 1, 2, 4, 'wood'),
    presetCuboid(4, 6, 5, 9, 1, 1, 'wood'),
    presetCuboid(4, 6, 8, 9, 1, 1, 'wood'),
    presetCanopy(2, 2, 3, 2, 2, 3, 'sakura'),
    presetCanopy(14, 2, 12, 2, 2, 3, 'leaf'),
    [
      presetVoxel(2, 1, 11, 'stone'),
      presetVoxel(4, 1, 12, 'stone'),
      presetVoxel(13, 1, 3, 'stone'),
      presetVoxel(15, 1, 5, 'stone'),
      presetVoxel(8, 4, 7, 'water'),
      presetVoxel(5, 2, 5, 'leaf'),
      presetVoxel(11, 2, 9, 'leaf'),
    ],
  ]),
  makePreset('london-cobble-square', 'london', 'Terrain', 'Cobble Square', ['pavement', 'stone', 'landmark'], [
    presetCuboid(0, 0, 0, 9, 1, 9, 'pavement'),
    presetFrame(0, 1, 0, 9, 9, 'stone'),
    presetCuboid(4, 1, 0, 1, 1, 9, 'stone'),
    presetCuboid(0, 1, 4, 9, 1, 1, 'stone'),
    [presetVoxel(4, 2, 4, 'landmark')],
  ]),
  makePreset('london-zebra-crossing', 'london', 'Terrain', 'Zebra Crossing', ['road', 'pavement', 'stone'], [
    presetCuboid(0, 0, 0, 10, 1, 7, 'road'),
    presetCuboid(0, 1, 0, 10, 1, 1, 'pavement'),
    presetCuboid(0, 1, 6, 10, 1, 1, 'pavement'),
    presetCuboid(1, 1, 2, 1, 1, 3, 'pavement'),
    presetCuboid(3, 1, 2, 1, 1, 3, 'pavement'),
    presetCuboid(5, 1, 2, 1, 1, 3, 'pavement'),
    presetCuboid(7, 1, 2, 1, 1, 3, 'pavement'),
    presetCuboid(9, 1, 2, 1, 1, 3, 'pavement'),
  ]),
  makePreset('london-canal-edge', 'london', 'Terrain', 'Canal Edge', ['water', 'stone', 'pavement', 'iron'], [
    presetCuboid(0, 0, 0, 12, 1, 5, 'water'),
    presetCuboid(0, 1, 5, 12, 1, 3, 'pavement'),
    presetCuboid(0, 1, 4, 12, 1, 1, 'stone'),
    presetPosts([[1, 4], [4, 4], [7, 4], [10, 4]], 2, 2, 'iron'),
    presetCuboid(1, 3, 4, 10, 1, 1, 'iron'),
  ]),
  makePreset('london-rail-track', 'london', 'Terrain', 'Rail Track', ['road', 'wood', 'iron'], [
    presetCuboid(0, 0, 0, 12, 1, 5, 'road'),
    presetCuboid(0, 1, 1, 12, 1, 1, 'iron'),
    presetCuboid(0, 1, 3, 12, 1, 1, 'iron'),
    presetCuboid(1, 1, 0, 1, 1, 5, 'wood'),
    presetCuboid(4, 1, 0, 1, 1, 5, 'wood'),
    presetCuboid(7, 1, 0, 1, 1, 5, 'wood'),
    presetCuboid(10, 1, 0, 1, 1, 5, 'wood'),
  ]),
  makePreset('japan-zen-sand-garden', 'japanese', 'Terrain', 'Zen Sand Garden', ['pavement', 'stone', 'leaf'], [
    presetCuboid(0, 0, 0, 11, 1, 8, 'pavement'),
    presetFrame(0, 1, 0, 11, 8, 'wood'),
    presetCuboid(2, 1, 2, 7, 1, 1, 'stone'),
    presetCuboid(3, 1, 4, 5, 1, 1, 'stone'),
    [presetVoxel(2, 2, 5, 'stone'), presetVoxel(8, 2, 2, 'stone'), presetVoxel(5, 2, 6, 'leaf')],
  ]),
  makePreset('japan-stepping-stones', 'japanese', 'Terrain', 'Stepping Stones', ['grass', 'stone', 'water'], [
    presetCuboid(0, 0, 0, 11, 1, 7, 'grass'),
    presetCuboid(0, 1, 3, 11, 1, 1, 'water'),
    [
      presetVoxel(1, 1, 2, 'stone'),
      presetVoxel(3, 1, 3, 'stone'),
      presetVoxel(5, 1, 4, 'stone'),
      presetVoxel(7, 1, 3, 'stone'),
      presetVoxel(9, 1, 2, 'stone'),
      presetVoxel(2, 1, 5, 'sakura'),
      presetVoxel(8, 1, 5, 'leaf'),
    ],
  ]),
  makePreset('japan-koi-pond-tile', 'japanese', 'Terrain', 'Koi Pond Tile', ['water', 'stone', 'leaf', 'sakura'], [
    presetCuboid(0, 0, 0, 10, 1, 8, 'stone'),
    presetEllipse(5, 1, 4, 4, 3, 'water'),
    presetFrame(0, 1, 0, 10, 8, 'stone'),
    [
      presetVoxel(3, 2, 3, 'sakura'),
      presetVoxel(6, 2, 5, 'sakura'),
      presetVoxel(7, 2, 2, 'leaf'),
      presetVoxel(2, 2, 6, 'leaf'),
    ],
  ]),
  makePreset('japan-mossy-corner', 'japanese', 'Terrain', 'Mossy Corner', ['grass', 'stone', 'leaf'], [
    presetCuboid(0, 0, 0, 9, 1, 9, 'grass'),
    presetCuboid(0, 1, 0, 4, 1, 4, 'stone'),
    presetCuboid(5, 1, 5, 4, 1, 4, 'stone'),
    presetCanopy(2, 1, 6, 2, 2, 2, 'leaf'),
    [presetVoxel(1, 2, 1, 'leaf'), presetVoxel(6, 2, 6, 'leaf'), presetVoxel(7, 2, 7, 'sakura')],
  ]),
  makePreset('london-royal-hedge', 'london', 'Vegetation', 'Royal Hedge', ['leaf', 'stone', 'sakura'], [
    presetFrame(0, 0, 0, 11, 7, 'stone'),
    presetFrame(1, 1, 1, 9, 5, 'leaf'),
    presetCuboid(5, 1, 2, 1, 1, 3, 'sakura'),
    presetCuboid(3, 1, 3, 5, 1, 1, 'sakura'),
    [presetVoxel(5, 2, 3, 'landmark')],
  ]),
  makePreset('london-flower-urn', 'london', 'Vegetation', 'Flower Urn', ['stone', 'leaf', 'sakura'], [
    presetCuboid(1, 0, 1, 3, 1, 3, 'stone'),
    presetCuboid(2, 1, 2, 1, 2, 1, 'stone'),
    presetCuboid(1, 3, 1, 3, 1, 3, 'stone'),
    presetCanopy(2, 4, 2, 2, 2, 2, 'sakura'),
    [presetVoxel(1, 4, 2, 'leaf'), presetVoxel(3, 4, 2, 'leaf'), presetVoxel(2, 5, 1, 'sakura')],
  ]),
  makePreset('london-willow-tree', 'london', 'Vegetation', 'Willow Tree', ['wood', 'leaf', 'water'], [
    presetEllipse(5, 0, 5, 4, 4, 'water'),
    presetCuboid(4, 0, 4, 2, 6, 2, 'wood'),
    presetCanopy(5, 5, 5, 5, 5, 4, 'leaf'),
    presetCuboid(2, 3, 2, 1, 4, 1, 'leaf'),
    presetCuboid(8, 3, 3, 1, 4, 1, 'leaf'),
    presetCuboid(3, 3, 8, 1, 4, 1, 'leaf'),
    presetCuboid(7, 3, 8, 1, 4, 1, 'leaf'),
  ]),
  makePreset('japan-pine-tree', 'japanese', 'Vegetation', 'Layered Pine', ['wood', 'leaf', 'stone'], [
    presetCuboid(4, 0, 4, 1, 7, 1, 'wood'),
    presetSteppedRoof(1, 3, 1, 7, 7, 2, 'leaf'),
    presetSteppedRoof(2, 5, 2, 5, 5, 2, 'leaf'),
    presetSteppedRoof(3, 7, 3, 3, 3, 2, 'leaf'),
    [presetVoxel(4, 9, 4, 'leaf'), presetVoxel(4, 0, 5, 'stone')],
  ]),
  makePreset('japan-bonsai-planter', 'japanese', 'Vegetation', 'Bonsai Planter', ['stone', 'wood', 'leaf'], [
    presetFrame(0, 0, 0, 7, 5, 'stone'),
    presetCuboid(1, 0, 1, 5, 1, 3, 'soil'),
    presetCuboid(3, 1, 2, 1, 3, 1, 'wood'),
    presetLine(3, 3, 2, 1, 4, 1, 'wood'),
    presetLine(3, 3, 2, 5, 4, 3, 'wood'),
    presetCanopy(1, 4, 1, 2, 2, 2, 'leaf'),
    presetCanopy(5, 4, 3, 2, 2, 2, 'leaf'),
  ]),
  makePreset('japan-lotus-patch', 'japanese', 'Vegetation', 'Lotus Patch', ['water', 'leaf', 'sakura'], [
    presetCuboid(0, 0, 0, 9, 1, 7, 'water'),
    [
      presetVoxel(1, 1, 1, 'leaf'),
      presetVoxel(2, 1, 4, 'leaf'),
      presetVoxel(4, 1, 2, 'leaf'),
      presetVoxel(5, 1, 5, 'leaf'),
      presetVoxel(7, 1, 3, 'leaf'),
      presetVoxel(1, 2, 1, 'sakura'),
      presetVoxel(5, 2, 5, 'sakura'),
      presetVoxel(7, 2, 3, 'sakura'),
    ],
  ]),
  makePreset('london-lit-shopfront', 'london', 'Buildings', 'Lit Shopfront', ['brick', 'window', 'roof', 'lamp'], [
    presetCuboid(0, 0, 0, 10, 1, 7, 'stone'),
    presetCuboid(1, 1, 1, 8, 4, 5, 'brick'),
    presetCuboid(0, 5, 0, 10, 1, 7, 'roof'),
    presetCuboid(1, 6, 1, 8, 1, 5, 'roof'),
    presetCuboid(2, 2, 0, 2, 2, 1, 'window'),
    presetCuboid(6, 2, 0, 2, 2, 1, 'window'),
    presetCuboid(4, 1, 0, 2, 3, 1, 'cab'),
    [presetVoxel(1, 4, 0, 'lamp'), presetVoxel(8, 4, 0, 'lamp'), presetVoxel(5, 5, 0, 'landmark')],
  ]),
  makePreset('london-glass-office', 'london', 'Buildings', 'Glass Office', ['glass', 'window', 'iron', 'roof'], [
    presetCuboid(0, 0, 0, 9, 1, 9, 'stone'),
    presetCuboid(1, 1, 1, 7, 10, 7, 'glass'),
    presetCuboid(0, 11, 0, 9, 1, 9, 'roof'),
    presetCuboid(2, 3, 0, 1, 7, 1, 'window'),
    presetCuboid(5, 2, 0, 1, 8, 1, 'window'),
    presetCuboid(8, 3, 2, 1, 6, 1, 'window'),
    presetCuboid(0, 4, 5, 1, 5, 1, 'window'),
    presetLine(1, 1, 1, 7, 10, 7, 'iron'),
    presetLine(7, 1, 1, 1, 10, 7, 'iron'),
  ]),
  makePreset('london-rail-station', 'london', 'Buildings', 'Rail Station', ['brick', 'glass', 'iron', 'window'], [
    presetCuboid(0, 0, 0, 16, 1, 8, 'stone'),
    presetCuboid(1, 1, 1, 14, 4, 6, 'brick'),
    presetCuboid(3, 2, 0, 10, 3, 1, 'window'),
    presetCuboid(0, 5, 0, 16, 1, 8, 'iron'),
    presetCuboid(1, 6, 1, 14, 1, 6, 'glass'),
    presetCuboid(3, 7, 2, 10, 1, 4, 'glass'),
    presetPosts([[1, 0], [14, 0], [1, 7], [14, 7]], 1, 5, 'iron'),
    [presetVoxel(7, 5, 0, 'lamp'), presetVoxel(8, 5, 0, 'lamp')],
  ]),
  makePreset('japan-teahouse', 'japanese', 'Buildings', 'Tea House', ['wood', 'roof', 'window', 'stone'], [
    presetCuboid(0, 0, 0, 11, 1, 9, 'stone'),
    presetCuboid(1, 1, 1, 9, 4, 7, 'wood'),
    presetCuboid(0, 5, 0, 11, 1, 9, 'roof'),
    presetCuboid(1, 6, 1, 9, 1, 7, 'roof'),
    presetCuboid(3, 2, 0, 2, 2, 1, 'window'),
    presetCuboid(6, 2, 0, 2, 2, 1, 'window'),
    presetCuboid(5, 1, 8, 1, 3, 1, 'bus'),
    [presetVoxel(1, 1, 0, 'lamp'), presetVoxel(9, 1, 0, 'lamp')],
  ]),
  makePreset('japan-covered-walkway', 'japanese', 'Buildings', 'Covered Walkway', ['wood', 'roof', 'pavement', 'lamp'], [
    presetCuboid(0, 0, 0, 15, 1, 5, 'pavement'),
    presetPosts([[0, 0], [3, 0], [6, 0], [9, 0], [12, 0], [14, 0], [0, 4], [3, 4], [6, 4], [9, 4], [12, 4], [14, 4]], 1, 4, 'wood'),
    presetCuboid(0, 5, 0, 15, 1, 5, 'roof'),
    presetCuboid(1, 6, 1, 13, 1, 3, 'roof'),
    [presetVoxel(3, 3, 2, 'lamp'), presetVoxel(7, 3, 2, 'lamp'), presetVoxel(11, 3, 2, 'lamp')],
  ]),
  makePreset('japan-bell-tower', 'japanese', 'Buildings', 'Bell Tower', ['wood', 'roof', 'landmark', 'lamp'], [
    presetCuboid(0, 0, 0, 7, 1, 7, 'stone'),
    presetPosts([[1, 1], [5, 1], [1, 5], [5, 5]], 1, 7, 'wood'),
    presetCuboid(0, 8, 0, 7, 1, 7, 'roof'),
    presetCuboid(1, 9, 1, 5, 1, 5, 'roof'),
    presetCuboid(3, 3, 3, 1, 3, 1, 'landmark'),
    presetLine(2, 6, 3, 4, 6, 3, 'wood'),
    [presetVoxel(2, 2, 2, 'lamp'), presetVoxel(4, 2, 4, 'lamp'), presetVoxel(3, 10, 3, 'landmark')],
  ]),
  makePreset('london-statue-plinth', 'london', 'Ornaments', 'Statue Plinth', ['stone', 'landmark', 'iron'], [
    presetCuboid(0, 0, 0, 5, 1, 5, 'stone'),
    presetCuboid(1, 1, 1, 3, 2, 3, 'stone'),
    presetCuboid(2, 3, 2, 1, 2, 1, 'landmark'),
    presetCuboid(1, 5, 2, 3, 1, 1, 'landmark'),
    [presetVoxel(2, 6, 2, 'landmark'), presetVoxel(0, 1, 0, 'iron'), presetVoxel(4, 1, 4, 'iron')],
  ]),
  makePreset('london-market-stall', 'london', 'Furniture', 'Market Stall', ['wood', 'bus', 'lamp', 'roof'], [
    presetCuboid(0, 0, 0, 7, 1, 5, 'wood'),
    presetPosts([[0, 0], [6, 0], [0, 4], [6, 4]], 1, 4, 'wood'),
    presetCuboid(0, 5, 0, 7, 1, 5, 'bus'),
    presetCuboid(1, 6, 1, 5, 1, 3, 'roof'),
    presetCuboid(1, 1, 1, 5, 1, 1, 'landmark'),
    [presetVoxel(3, 3, 2, 'lamp'), presetVoxel(2, 1, 3, 'leaf'), presetVoxel(4, 1, 3, 'sakura')],
  ]),
  makePreset('london-bench-row', 'london', 'Furniture', 'Bench Row', ['wood', 'iron', 'leaf'], [
    presetCuboid(0, 1, 1, 9, 1, 2, 'wood'),
    presetCuboid(0, 3, 2, 9, 1, 1, 'wood'),
    presetPosts([[1, 0], [4, 0], [7, 0], [1, 3], [4, 3], [7, 3]], 0, 2, 'iron'),
    [presetVoxel(2, 0, 4, 'leaf'), presetVoxel(6, 0, 4, 'sakura')],
  ]),
  makePreset('london-victorian-fence', 'london', 'Borders', 'Victorian Fence', ['iron', 'landmark'], [
    presetPosts([[0, 0], [2, 0], [4, 0], [6, 0], [8, 0], [10, 0]], 0, 4, 'iron'),
    presetCuboid(0, 1, 0, 11, 1, 1, 'iron'),
    presetCuboid(0, 3, 0, 11, 1, 1, 'iron'),
    [presetVoxel(0, 4, 0, 'landmark'), presetVoxel(4, 4, 0, 'landmark'), presetVoxel(8, 4, 0, 'landmark')],
  ]),
  makePreset('japan-paper-lantern-row', 'japanese', 'Lighting', 'Lantern Row', ['wood', 'lamp', 'bus'], [
    presetPosts([[0, 0], [3, 0], [6, 0], [9, 0]], 0, 4, 'wood'),
    presetCuboid(0, 4, 0, 10, 1, 1, 'wood'),
    [presetVoxel(1, 3, 0, 'lamp'), presetVoxel(4, 3, 0, 'lamp'), presetVoxel(7, 3, 0, 'lamp'), presetVoxel(9, 3, 0, 'bus')],
  ]),
  makePreset('japan-banner-pair', 'japanese', 'Ornaments', 'Banner Pair', ['bus', 'wood', 'stone'], [
    presetCuboid(0, 0, 0, 1, 6, 1, 'wood'),
    presetCuboid(6, 0, 0, 1, 6, 1, 'wood'),
    presetCuboid(1, 3, 0, 2, 3, 1, 'bus'),
    presetCuboid(4, 3, 0, 2, 3, 1, 'bus'),
    [presetVoxel(0, 6, 0, 'landmark'), presetVoxel(6, 6, 0, 'landmark'), presetVoxel(1, 0, 0, 'stone'), presetVoxel(5, 0, 0, 'stone')],
  ]),
  makePreset('japan-stone-basin', 'japanese', 'Ornaments', 'Stone Basin', ['stone', 'water', 'leaf'], [
    presetCuboid(0, 0, 0, 5, 1, 5, 'stone'),
    presetFrame(1, 1, 1, 3, 3, 'stone'),
    presetCuboid(2, 1, 2, 1, 1, 1, 'water'),
    presetCuboid(2, 2, 2, 1, 2, 1, 'water'),
    [presetVoxel(0, 1, 4, 'leaf'), presetVoxel(4, 1, 0, 'sakura')],
  ]),
  makePreset('japan-ornamental-gate', 'japanese', 'Ornaments', 'Garden Gate', ['wood', 'roof', 'lamp'], [
    presetCuboid(0, 0, 0, 2, 1, 2, 'stone'),
    presetCuboid(6, 0, 0, 2, 1, 2, 'stone'),
    presetPosts([[0, 0], [7, 0], [0, 1], [7, 1]], 1, 5, 'wood'),
    presetCuboid(0, 5, 0, 8, 1, 2, 'wood'),
    presetCuboid(0, 6, 0, 8, 1, 2, 'roof'),
    [presetVoxel(2, 3, 0, 'lamp'), presetVoxel(5, 3, 0, 'lamp'), presetVoxel(3, 4, 0, 'bus'), presetVoxel(4, 4, 0, 'bus')],
  ]),
  makePreset('london-bus-stop', 'london', 'Utilities', 'Bus Stop', ['glass', 'iron', 'underground', 'lamp'], [
    presetCuboid(0, 0, 0, 7, 1, 3, 'pavement'),
    presetPosts([[0, 0], [6, 0], [0, 2], [6, 2]], 1, 4, 'iron'),
    presetCuboid(0, 5, 0, 7, 1, 3, 'roof'),
    presetCuboid(1, 2, 0, 5, 2, 1, 'glass'),
    presetCuboid(6, 2, 1, 1, 2, 1, 'underground'),
    [presetVoxel(1, 4, 1, 'lamp'), presetVoxel(5, 4, 1, 'lamp'), presetVoxel(3, 1, 2, 'wood')],
  ]),
  makePreset('london-crate-stack', 'london', 'Utilities', 'Crate Stack', ['wood', 'stone', 'cab'], [
    presetCuboid(0, 0, 0, 2, 2, 2, 'wood'),
    presetCuboid(2, 0, 1, 2, 2, 2, 'wood'),
    presetCuboid(1, 2, 1, 2, 2, 2, 'wood'),
    presetCuboid(4, 0, 0, 1, 3, 1, 'stone'),
    [presetVoxel(0, 2, 2, 'cab'), presetVoxel(3, 2, 0, 'cab')],
  ]),
  makePreset('london-ticket-kiosk', 'london', 'Utilities', 'Ticket Kiosk', ['underground', 'glass', 'window', 'roof'], [
    presetCuboid(0, 0, 0, 5, 1, 5, 'stone'),
    presetCuboid(1, 1, 1, 3, 4, 3, 'underground'),
    presetCuboid(0, 5, 0, 5, 1, 5, 'roof'),
    presetCuboid(1, 2, 0, 3, 2, 1, 'window'),
    presetCuboid(4, 2, 1, 1, 2, 3, 'glass'),
    [presetVoxel(2, 6, 2, 'lamp'), presetVoxel(2, 1, 0, 'bus')],
  ]),
  makePreset('japan-market-cart', 'japanese', 'Utilities', 'Market Cart', ['wood', 'roof', 'leaf', 'sakura'], [
    presetCuboid(0, 1, 0, 7, 1, 4, 'wood'),
    presetPosts([[0, 0], [6, 0], [0, 3], [6, 3]], 2, 3, 'wood'),
    presetCuboid(0, 5, 0, 7, 1, 4, 'roof'),
    presetCuboid(1, 2, 1, 2, 1, 2, 'leaf'),
    presetCuboid(4, 2, 1, 2, 1, 2, 'sakura'),
    [presetVoxel(1, 0, 0, 'cab'), presetVoxel(5, 0, 0, 'cab'), presetVoxel(3, 4, 2, 'lamp')],
  ]),
  makePreset('japan-storage-shed', 'japanese', 'Utilities', 'Storage Shed', ['wood', 'roof', 'stone'], [
    presetCuboid(0, 0, 0, 7, 1, 6, 'stone'),
    presetCuboid(1, 1, 1, 5, 4, 4, 'wood'),
    presetCuboid(0, 5, 0, 7, 1, 6, 'roof'),
    presetCuboid(1, 6, 1, 5, 1, 4, 'roof'),
    presetCuboid(3, 1, 0, 1, 3, 1, 'cab'),
    [presetVoxel(1, 2, 0, 'window'), presetVoxel(5, 2, 0, 'window')],
  ]),
  makePreset('japan-wood-crates', 'japanese', 'Utilities', 'Wood Crates', ['wood', 'stone', 'water'], [
    presetCuboid(0, 0, 0, 2, 2, 2, 'wood'),
    presetCuboid(3, 0, 0, 2, 3, 2, 'wood'),
    presetCuboid(1, 0, 3, 3, 2, 2, 'wood'),
    presetCuboid(5, 0, 3, 2, 2, 2, 'stone'),
    [presetVoxel(5, 2, 4, 'water'), presetVoxel(2, 2, 1, 'landmark')],
  ]),
  makePreset('japan-water-buckets', 'japanese', 'Utilities', 'Water Buckets', ['wood', 'water', 'iron'], [
    presetFrame(0, 0, 0, 3, 3, 'wood'),
    presetFrame(4, 0, 1, 3, 3, 'wood'),
    presetCuboid(1, 0, 1, 1, 1, 1, 'water'),
    presetCuboid(5, 0, 2, 1, 1, 1, 'water'),
    presetLine(0, 2, 1, 2, 2, 1, 'iron'),
    presetLine(4, 2, 2, 6, 2, 2, 'iron'),
  ]),
];

function blockCatalogItem(type: VoxelType, category: CatalogCategory, label: string): CatalogItem {
  return {
    id: `block-${type}`,
    category,
    kind: 'block',
    label,
    swatches: [type],
    blockType: type,
  };
}

function makePreset(
  id: string,
  theme: PresetTheme,
  category: string,
  label: string,
  swatches: VoxelType[],
  parts: PresetVoxel[][],
): ObjectPreset {
  return {
    id,
    theme,
    category,
    label,
    swatches,
    voxels: uniquePresetVoxels(parts.flat()),
  };
}

function presetVoxel(dx: number, dy: number, dz: number, type: VoxelType): PresetVoxel {
  return { dx, dy, dz, type };
}

function presetCuboid(
  startX: number,
  startY: number,
  startZ: number,
  width: number,
  height: number,
  depth: number,
  type: VoxelType,
): PresetVoxel[] {
  const voxels: PresetVoxel[] = [];

  for (let dx = startX; dx < startX + width; dx += 1) {
    for (let dy = startY; dy < startY + height; dy += 1) {
      for (let dz = startZ; dz < startZ + depth; dz += 1) {
        voxels.push(presetVoxel(dx, dy, dz, type));
      }
    }
  }

  return voxels;
}

function presetFrame(startX: number, startY: number, startZ: number, width: number, depth: number, type: VoxelType): PresetVoxel[] {
  const voxels: PresetVoxel[] = [];

  for (let dx = startX; dx < startX + width; dx += 1) {
    voxels.push(presetVoxel(dx, startY, startZ, type));
    voxels.push(presetVoxel(dx, startY, startZ + depth - 1, type));
  }

  for (let dz = startZ + 1; dz < startZ + depth - 1; dz += 1) {
    voxels.push(presetVoxel(startX, startY, dz, type));
    voxels.push(presetVoxel(startX + width - 1, startY, dz, type));
  }

  return voxels;
}

function presetSteppedRoof(startX: number, startY: number, startZ: number, width: number, depth: number, layers: number, type: VoxelType): PresetVoxel[] {
  const voxels: PresetVoxel[] = [];

  for (let layer = 0; layer < layers; layer += 1) {
    const inset = Math.min(layer, Math.floor((Math.min(width, depth) - 1) / 2));
    const layerWidth = Math.max(1, width - inset * 2);
    const layerDepth = Math.max(1, depth - inset * 2);
    voxels.push(...presetCuboid(startX + inset, startY + layer, startZ + inset, layerWidth, 1, layerDepth, type));
  }

  return voxels;
}

function presetCanopy(centerX: number, startY: number, centerZ: number, radiusX: number, radiusZ: number, height: number, type: VoxelType): PresetVoxel[] {
  const voxels: PresetVoxel[] = [];

  for (let dy = 0; dy < height; dy += 1) {
    const verticalFalloff = Math.abs(dy - (height - 1) / 2) / Math.max(1, height / 2);
    const layerRadiusX = Math.max(1, radiusX - verticalFalloff * 0.9);
    const layerRadiusZ = Math.max(1, radiusZ - verticalFalloff * 0.9);

    for (let dx = -radiusX; dx <= radiusX; dx += 1) {
      for (let dz = -radiusZ; dz <= radiusZ; dz += 1) {
        const normalized = (dx * dx) / (layerRadiusX * layerRadiusX) + (dz * dz) / (layerRadiusZ * layerRadiusZ);
        if (normalized <= 1.05) {
          voxels.push(presetVoxel(centerX + dx, startY + dy, centerZ + dz, type));
        }
      }
    }
  }

  return voxels;
}

function presetEllipse(centerX: number, y: number, centerZ: number, radiusX: number, radiusZ: number, type: VoxelType): PresetVoxel[] {
  const voxels: PresetVoxel[] = [];

  for (let dx = -radiusX; dx <= radiusX; dx += 1) {
    for (let dz = -radiusZ; dz <= radiusZ; dz += 1) {
      const normalized = (dx * dx) / (radiusX * radiusX) + (dz * dz) / (radiusZ * radiusZ);
      if (normalized <= 1.08) {
        voxels.push(presetVoxel(centerX + dx, y, centerZ + dz, type));
      }
    }
  }

  return voxels;
}

function presetWindows(startX: number, y: number, startZ: number, width: number, depth: number, type: VoxelType): PresetVoxel[] {
  const voxels: PresetVoxel[] = [];

  for (let x = startX + 1; x < startX + width - 1; x += 2) {
    voxels.push(presetVoxel(x, y, startZ, type), presetVoxel(x, y, startZ + depth - 1, type));
  }

  for (let z = startZ + 1; z < startZ + depth - 1; z += 2) {
    voxels.push(presetVoxel(startX, y, z, type), presetVoxel(startX + width - 1, y, z, type));
  }

  return voxels;
}

function presetPosts(points: Array<[number, number]>, startY: number, height: number, type: VoxelType): PresetVoxel[] {
  return points.flatMap(([x, z]) => presetCuboid(x, startY, z, 1, height, 1, type));
}

function presetLine(startX: number, startY: number, startZ: number, endX: number, endY: number, endZ: number, type: VoxelType): PresetVoxel[] {
  const voxels: PresetVoxel[] = [];
  const steps = Math.max(Math.abs(endX - startX), Math.abs(endY - startY), Math.abs(endZ - startZ), 1);

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    voxels.push(presetVoxel(
      Math.round(THREE.MathUtils.lerp(startX, endX, t)),
      Math.round(THREE.MathUtils.lerp(startY, endY, t)),
      Math.round(THREE.MathUtils.lerp(startZ, endZ, t)),
      type,
    ));
  }

  return voxels;
}

function presetDome(centerX: number, startY: number, centerZ: number, radiusX: number, radiusZ: number, height: number, type: VoxelType): PresetVoxel[] {
  const voxels: PresetVoxel[] = [];

  for (let dy = 0; dy < height; dy += 1) {
    const t = dy / Math.max(1, height - 1);
    const layerRadiusX = Math.max(1, Math.round(radiusX * Math.sqrt(1 - t * 0.82)));
    const layerRadiusZ = Math.max(1, Math.round(radiusZ * Math.sqrt(1 - t * 0.82)));

    for (let dx = -layerRadiusX; dx <= layerRadiusX; dx += 1) {
      for (let dz = -layerRadiusZ; dz <= layerRadiusZ; dz += 1) {
        const normalized = (dx * dx) / (layerRadiusX * layerRadiusX) + (dz * dz) / (layerRadiusZ * layerRadiusZ);
        if (normalized <= 1.12) {
          voxels.push(presetVoxel(centerX + dx, startY + dy, centerZ + dz, type));
        }
      }
    }
  }

  return voxels;
}

function presetTaperedTower(centerX: number, startY: number, centerZ: number, radius: number, height: number, type: VoxelType): PresetVoxel[] {
  const voxels: PresetVoxel[] = [];

  for (let y = 0; y < height; y += 1) {
    const layerRadius = Math.max(1, Math.round(radius - y * (radius - 1) / Math.max(1, height - 1)));
    for (let dx = -layerRadius; dx <= layerRadius; dx += 1) {
      for (let dz = -layerRadius; dz <= layerRadius; dz += 1) {
        if (Math.abs(dx) + Math.abs(dz) <= layerRadius + 1) {
          voxels.push(presetVoxel(centerX + dx, startY + y, centerZ + dz, type));
        }
      }
    }
  }

  return voxels;
}

function presetWheel(centerX: number, centerY: number, z: number, radius: number, type: VoxelType, cabinType: VoxelType): PresetVoxel[] {
  const voxels: PresetVoxel[] = [];

  for (let angle = 0; angle < 360; angle += 8) {
    const radians = THREE.MathUtils.degToRad(angle);
    const x = Math.round(centerX + Math.cos(radians) * radius);
    const y = Math.round(centerY + Math.sin(radians) * radius);
    voxels.push(presetVoxel(x, y, z, angle % 32 === 0 ? cabinType : type));
  }

  for (let angle = 0; angle < 360; angle += 30) {
    const radians = THREE.MathUtils.degToRad(angle);
    for (let step = 0; step <= radius; step += 1) {
      const x = Math.round(centerX + Math.cos(radians) * step);
      const y = Math.round(centerY + Math.sin(radians) * step);
      voxels.push(presetVoxel(x, y, z, type));
    }
  }

  voxels.push(presetVoxel(centerX, centerY, z, cabinType));
  return voxels;
}

function presetSteps(startX: number, startY: number, startZ: number, width: number, steps: number, type: VoxelType): PresetVoxel[] {
  const voxels: PresetVoxel[] = [];

  for (let step = 0; step < steps; step += 1) {
    voxels.push(...presetCuboid(startX + step, startY + step, startZ + step, Math.max(1, width - step * 2), 1, 1, type));
  }

  return voxels;
}

function presetWallRun(startX: number, startY: number, startZ: number, width: number, depth: number, height: number, type: VoxelType): PresetVoxel[] {
  const voxels: PresetVoxel[] = [];
  voxels.push(...presetCuboid(startX, startY, startZ, width, height, 1, type));
  voxels.push(...presetCuboid(startX, startY, startZ + depth - 1, width, height, 1, type));
  voxels.push(...presetCuboid(startX, startY, startZ + 1, 1, height, Math.max(0, depth - 2), type));
  voxels.push(...presetCuboid(startX + width - 1, startY, startZ + 1, 1, height, Math.max(0, depth - 2), type));
  return voxels;
}

function uniquePresetVoxels(voxels: PresetVoxel[]): PresetVoxel[] {
  const unique = new Map<string, PresetVoxel>();

  for (const voxel of voxels) {
    unique.set(`${voxel.dx},${voxel.dy},${voxel.dz}`, voxel);
  }

  return Array.from(unique.values());
}

function createSkyTexture(mode: 'day' | 'night'): THREE.CanvasTexture {
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 1024;
  skyCanvas.height = 512;
  const context = skyCanvas.getContext('2d');

  if (!context) {
    throw new Error('Sky texture failed to initialize.');
  }

  context.fillStyle = mode === 'night' ? '#142238' : '#d9eef4';
  context.fillRect(0, 0, skyCanvas.width, skyCanvas.height);

  const texture = new THREE.CanvasTexture(skyCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}

function createGlowTexture(): THREE.CanvasTexture {
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 128;
  glowCanvas.height = 128;
  const context = glowCanvas.getContext('2d');

  if (!context) {
    throw new Error('Glow texture failed to initialize.');
  }

  const glow = context.createRadialGradient(64, 64, 4, 64, 64, 64);
  glow.addColorStop(0, 'rgba(255, 244, 204, 0.88)');
  glow.addColorStop(0.24, 'rgba(255, 204, 114, 0.44)');
  glow.addColorStop(0.64, 'rgba(255, 177, 78, 0.12)');
  glow.addColorStop(1, 'rgba(255, 177, 78, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, glowCanvas.width, glowCanvas.height);

  const texture = new THREE.CanvasTexture(glowCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const voxelData = new Map<string, VoxelType>();
const undoStack: VoxelSnapshot[] = [];
const redoStack: VoxelSnapshot[] = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const worldMatrix = new THREE.Matrix4();
const clock = new THREE.Clock();
const materials = new Map<string, THREE.MeshStandardMaterial>();
const renderLookup: THREE.Object3D[] = [];
const exploreMoveKeys = new Set<string>();
const exploreCameraTarget = new THREE.Vector3();
const exploreDesiredCameraPosition = new THREE.Vector3();
const exploreMoveVector = new THREE.Vector2();
const SHADE_AMOUNTS = [-0.1, -0.07, -0.045, -0.02, 0, 0.035, 0.06] as const;
const MAX_SCENE_LIGHTS = 128;

let activeTool: Tool = 'paint';
let selectedType: VoxelType = 'brick';
let activeTheme: PresetTheme = 'japanese';
let activeCategory: CatalogCategory = 'terrain';
let selectedPresetId: string | null = null;
let presetRotation: PresetRotation = 0;
let ambientEnabled = true;
let nightModeEnabled = false;
let gridEnabled = true;
let bordersEnabled = true;
let brushSize = 1;
let hoverVoxel: Voxel | null = null;
let pointerInCanvas = false;
let pointerDown: { x: number; y: number; button: number } | null = null;
let replaceTargetMode = false;
let toastTimeout = 0;
let currentMusicTrack = 0;
let musicPlaying = false;
let musicMuted = false;
let musicAutoplayPending = true;
let explorePointerDrag: { x: number; y: number } | null = null;
let exploreYaw = Math.PI * 0.82;
let explorePitch = 0.48;
let exploreCameraDistance = 12;

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

const canvas = requiredElement<HTMLCanvasElement>('#scene');
const assetGrid = requiredElement<HTMLDivElement>('#assetGrid');
const categoryTabs = requiredElement<HTMLDivElement>('#categoryTabs');
const themeTabs = requiredElement<HTMLDivElement>('#themeTabs');
const activeThemeLabel = requiredElement<HTMLElement>('#activeThemeLabel');
const statusLine = requiredElement<HTMLParagraphElement>('#statusLine');
const selectedBlock = requiredElement<HTMLSpanElement>('#selectedBlock');
const blockCount = requiredElement<HTMLSpanElement>('#blockCount');
const brushInput = requiredElement<HTMLInputElement>('#brushSize');
const brushValue = requiredElement<HTMLOutputElement>('#brushValue');
const timeSlider = requiredElement<HTMLInputElement>('#timeSlider');
const timeLabel = requiredElement<HTMLSpanElement>('#timeLabel');
const toast = requiredElement<HTMLDivElement>('#toast');
const fileInput = requiredElement<HTMLInputElement>('#fileInput');
const musicPlayButton = requiredElement<HTMLButtonElement>('#musicPlayButton');
const musicMuteButton = requiredElement<HTMLButtonElement>('#musicMuteButton');
const musicPlayer = new Audio(MUSIC_TRACKS[currentMusicTrack]);
musicPlayer.autoplay = true;
musicPlayer.preload = 'auto';
musicPlayer.volume = 0.44;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
const daySkyTexture = createSkyTexture('day');
const nightSkyTexture = createSkyTexture('night');
scene.background = daySkyTexture;

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 260);
camera.position.set(72, 58, 84);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.42, 0.46, 0.34);
composer.addPass(renderPass);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 2.2, 0);
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 14;
controls.maxDistance = 172;

const hemiLight = new THREE.HemisphereLight(0xe9f4ff, 0x6d5a45, 2.1);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff0cf, 3.4);
sunLight.position.set(-20, 42, 24);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -104;
sunLight.shadow.camera.right = 104;
sunLight.shadow.camera.top = 104;
sunLight.shadow.camera.bottom = -104;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 220;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0xbcd8ff, 1.1);
fillLight.position.set(26, 18, -26);
scene.add(fillLight);

const lampLightGroup = new THREE.Group();
lampLightGroup.visible = false;
scene.add(lampLightGroup);

const voxelGroup = new THREE.Group();
scene.add(voxelGroup);

const baseGeometry = new THREE.BoxGeometry(1, 1, 1);
const glowTexture = createGlowTexture();
const previewGeometry = new THREE.BoxGeometry(1.04, 1.04, 1.04);
const previewMaterial = new THREE.MeshBasicMaterial({
  color: BLOCKS[selectedType].color,
  transparent: true,
  opacity: 0.46,
  wireframe: true,
});
const previewMesh = new THREE.Mesh(previewGeometry, previewMaterial);
previewMesh.visible = false;
scene.add(previewMesh);

const presetPreviewGroup = new THREE.Group();
presetPreviewGroup.visible = false;
scene.add(presetPreviewGroup);

const backgroundGrid = new THREE.GridHelper(300, 150, 0xf8f6ed, 0xbecbd1);
backgroundGrid.position.y = -0.035;
const backgroundGridMaterial = backgroundGrid.material as THREE.Material;
backgroundGridMaterial.transparent = true;
backgroundGridMaterial.opacity = 0.2;
backgroundGridMaterial.depthWrite = false;
scene.add(backgroundGrid);

const gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0xf6f9f8, 0x60727d);
gridHelper.position.y = 0.512;
const gridMaterial = gridHelper.material as THREE.Material;
gridMaterial.transparent = true;
gridMaterial.opacity = 0.18;
scene.add(gridHelper);

const groundPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE),
  new THREE.MeshBasicMaterial({ visible: false }),
);
groundPlane.rotateX(-Math.PI / 2);
groundPlane.position.y = 0.02;
groundPlane.userData.isGround = true;
scene.add(groundPlane);

const avatarGroup = createAvatar();
avatarGroup.visible = false;
scene.add(avatarGroup);

createIcons({ icons });
updateMusicControls();
buildThemeTabs();
buildCategoryTabs();
buildAssetGrid();
generateCleanMap();
rebuildScene();
updateUi();
resize();
animate();

window.addEventListener('resize', resize);
renderer.domElement.addEventListener('pointerenter', () => {
  pointerInCanvas = true;
});
renderer.domElement.addEventListener('pointerleave', () => {
  pointerInCanvas = false;
  explorePointerDrag = null;
  replaceTargetMode = false;
  hoverVoxel = null;
  previewMesh.visible = false;
  presetPreviewGroup.visible = false;
});
renderer.domElement.addEventListener('pointermove', (event) => {
  if (activeTool === 'explore') {
    updateExplorePointerDrag(event);
    return;
  }

  replaceTargetMode = isReplacePointerEvent(event);
  updatePointer(event);
  updateHover();
});
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (activeTool === 'explore') {
    if (event.button === 0) {
      explorePointerDrag = { x: event.clientX, y: event.clientY };
      renderer.domElement.style.cursor = 'grabbing';
      event.preventDefault();
    }
    return;
  }

  if (event.button === 0 || event.button === 2) {
    replaceTargetMode = isReplacePointerEvent(event);
    pointerDown = { x: event.clientX, y: event.clientY, button: event.button };
  }
});
renderer.domElement.addEventListener('pointerup', (event) => {
  if (activeTool === 'explore') {
    explorePointerDrag = null;
    renderer.domElement.style.cursor = 'grab';
    return;
  }

  if (!pointerDown) {
    return;
  }

  const distance = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
  const button = pointerDown.button;
  pointerDown = null;

  if (distance > 5) {
    return;
  }

  replaceTargetMode = isReplacePointerEvent(event);
  updatePointer(event);
  applyPointerEdit(button === 2 ? 'erase' : activeTool, replaceTargetMode);
});
renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
renderer.domElement.addEventListener('wheel', (event) => {
  if (activeTool !== 'explore') {
    return;
  }

  exploreCameraDistance = THREE.MathUtils.clamp(
    exploreCameraDistance + Math.sign(event.deltaY) * 0.8,
    EXPLORE_CAMERA_MIN_DISTANCE,
    EXPLORE_CAMERA_MAX_DISTANCE,
  );
  event.preventDefault();
}, { passive: false });

document.querySelector<HTMLButtonElement>('#placeTool')?.addEventListener('click', activatePlaceTool);
document.querySelector<HTMLButtonElement>('#paintTool')?.addEventListener('click', () => setTool('paint'));
document.querySelector<HTMLButtonElement>('#eraseTool')?.addEventListener('click', () => setTool('erase'));
document.querySelector<HTMLButtonElement>('#sampleTool')?.addEventListener('click', () => setTool('sample'));
document.querySelector<HTMLButtonElement>('#panTool')?.addEventListener('click', () => setTool('pan'));
document.querySelector<HTMLButtonElement>('#orbitTool')?.addEventListener('click', () => setTool('orbit'));
document.querySelector<HTMLButtonElement>('#zoomTool')?.addEventListener('click', () => setTool('zoom'));
document.querySelector<HTMLButtonElement>('#exploreButton')?.addEventListener('click', toggleExploreMode);
document.querySelector<HTMLButtonElement>('#undoButton')?.addEventListener('click', undo);
document.querySelector<HTMLButtonElement>('#redoButton')?.addEventListener('click', redo);
document.querySelector<HTMLButtonElement>('#newMapButton')?.addEventListener('click', createNewMap);
document.querySelector<HTMLButtonElement>('#instructionsButton')?.addEventListener('click', showInstructions);
musicPlayButton.addEventListener('click', toggleMusicPlayback);
musicMuteButton.addEventListener('click', toggleMusicMute);
document.querySelector<HTMLButtonElement>('#rotatePresetButton')?.addEventListener('click', rotateSelectedPreset);
document.querySelector<HTMLButtonElement>('#resetButton')?.addEventListener('click', () => {
  applyWithHistory(() => {
    generateCleanMap();
    return true;
  });
  applyControlMode(activeTool);
  buildAssetGrid();
  updateUi();
  showToast('Map reset');
});
document.querySelector<HTMLButtonElement>('#saveButton')?.addEventListener('click', saveToBrowser);
document.querySelector<HTMLButtonElement>('#loadButton')?.addEventListener('click', loadFromBrowser);
document.querySelector<HTMLButtonElement>('#exportButton')?.addEventListener('click', exportJson);
document.querySelector<HTMLButtonElement>('#importButton')?.addEventListener('click', () => fileInput.click());

timeSlider.addEventListener('input', () => {
  updateSunFromSlider();
  updateToggleButton('#nightToggle', nightModeEnabled);
});

brushInput.addEventListener('input', () => {
  brushSize = Number(brushInput.value);
  brushValue.value = String(brushSize);
  updateUi();
});

document.querySelector<HTMLButtonElement>('#ambientToggle')?.addEventListener('click', () => {
  ambientEnabled = !ambientEnabled;
  updateSunFromSlider();
  updateUi();
});

document.querySelector<HTMLButtonElement>('#nightToggle')?.addEventListener('click', () => {
  nightModeEnabled = !nightModeEnabled;
  timeSlider.value = nightModeEnabled ? '21.5' : '10.75';
  updateSunFromSlider();
  updateUi();
});

document.querySelector<HTMLButtonElement>('#gridToggle')?.addEventListener('click', () => {
  gridEnabled = !gridEnabled;
  gridHelper.visible = gridEnabled;
  backgroundGrid.visible = gridEnabled;
  updateUi();
});

document.querySelector<HTMLButtonElement>('#bordersToggle')?.addEventListener('click', () => {
  bordersEnabled = !bordersEnabled;
  updateGridTone();
  updateUi();
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const cityFile = JSON.parse(text) as CityFile;
    applyWithHistory(() => loadCityFile(cityFile));
    showToast('City imported');
  } catch (error) {
    console.error(error);
    showToast('Import failed');
  } finally {
    fileInput.value = '';
  }
});

musicPlayer.addEventListener('ended', playNextMusicTrack);
musicPlayer.addEventListener('error', () => {
  musicPlaying = false;
  musicAutoplayPending = false;
  updateMusicControls();
  showToast('Music could not be played');
});
void startMusicPlayback(false, false);
window.addEventListener('pointerdown', resumePendingMusicAutoplay, { capture: true });
window.addEventListener('keydown', resumePendingMusicAutoplay, { capture: true });

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement) {
    return;
  }

  if (handleExploreKeyDown(event)) {
    return;
  }

  if (event.key === 'Control' || event.key === 'Meta') {
    replaceTargetMode = true;
    updateHover();
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) {
      redo();
    } else {
      undo();
    }
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveToBrowser();
  }

  const key = event.key.toLowerCase();
  if (key === 'b') {
    setTool('paint');
  }
  if (key === 'p') {
    activatePlaceTool();
  }
  if (key === 'n') {
    createNewMap();
  }
  if (key === 'r') {
    rotateSelectedPreset();
  }
  if (key === 'e') {
    setTool('erase');
  }
  if (key === 'i') {
    setTool('sample');
  }
  if (key === 'o') {
    setTool('orbit');
  }
  if (key === 'v') {
    setTool('explore');
  }
});

window.addEventListener('keyup', (event) => {
  const exploreKey = normalizeExploreKey(event.key);
  if (exploreKey) {
    exploreMoveKeys.delete(exploreKey);
  }

  if (event.key === 'Control' || event.key === 'Meta') {
    replaceTargetMode = false;
    updateHover();
  }
});

window.addEventListener('blur', () => {
  exploreMoveKeys.clear();
  explorePointerDrag = null;
});

function keyFor(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function parseKey(key: string): [number, number, number] {
  const [x, y, z] = key.split(',').map(Number);
  return [x, y, z];
}

function isReplacePointerEvent(event: PointerEvent | MouseEvent): boolean {
  return event.ctrlKey || event.metaKey;
}

function isInBounds(x: number, y: number, z: number): boolean {
  return x >= 0 && x < GRID_SIZE && z >= 0 && z < GRID_SIZE && y >= MIN_HEIGHT && y <= MAX_HEIGHT;
}

function getVoxel(x: number, y: number, z: number): VoxelType | undefined {
  return voxelData.get(keyFor(x, y, z));
}

function setVoxel(x: number, y: number, z: number, type: VoxelType): boolean {
  if (!isInBounds(x, y, z)) {
    return false;
  }

  const key = keyFor(x, y, z);
  if (voxelData.get(key) === type) {
    return false;
  }

  voxelData.set(key, type);
  return true;
}

function removeVoxel(x: number, y: number, z: number): boolean {
  return voxelData.delete(keyFor(x, y, z));
}

function gridToWorldX(x: number): number {
  return x - HALF_GRID + 0.5;
}

function gridToWorldZ(z: number): number {
  return z - HALF_GRID + 0.5;
}

function worldToGridX(x: number): number {
  return Math.floor(x + HALF_GRID);
}

function worldToGridZ(z: number): number {
  return Math.floor(z + HALF_GRID);
}

function createAvatar(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Explore Avatar';

  const coatMaterial = new THREE.MeshStandardMaterial({ color: 0xdd5b32, roughness: 0.72 });
  const scarfMaterial = new THREE.MeshStandardMaterial({ color: 0xf7c65a, roughness: 0.7 });
  const headMaterial = new THREE.MeshStandardMaterial({ color: 0xf1d1a7, roughness: 0.76 });
  const bootMaterial = new THREE.MeshStandardMaterial({ color: 0x3c342d, roughness: 0.86 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.08, 0.48), coatMaterial);
  body.position.y = 0.95;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.52, 0.56), headMaterial);
  head.position.y = 1.76;
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);

  const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.16, 0.54), scarfMaterial);
  scarf.position.y = 1.42;
  scarf.castShadow = true;
  group.add(scarf);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.16), scarfMaterial);
  nose.position.set(0, 1.78, -0.36);
  nose.castShadow = true;
  group.add(nose);

  for (const x of [-0.22, 0.22]) {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.36), bootMaterial);
    boot.position.set(x, 0.14, -0.02);
    boot.castShadow = true;
    boot.receiveShadow = true;
    group.add(boot);
  }

  return group;
}

function getAvatarSurfaceYForCell(x: number, z: number): number | null {
  if (!isInBounds(x, 0, z)) {
    return null;
  }

  for (let y = 1; y <= MAX_HEIGHT; y += 1) {
    if (getVoxel(x, y, z)) {
      return null;
    }
  }

  for (let y = 0; y >= MIN_HEIGHT; y -= 1) {
    if (getVoxel(x, y, z)) {
      return y + 1;
    }
  }

  return 0;
}

function getAvatarSurfaceYAtWorld(x: number, z: number): number | null {
  let surfaceY = -Infinity;
  const samples = [
    [0, 0],
    [EXPLORE_AVATAR_RADIUS, 0],
    [-EXPLORE_AVATAR_RADIUS, 0],
    [0, EXPLORE_AVATAR_RADIUS],
    [0, -EXPLORE_AVATAR_RADIUS],
  ] as const;

  for (const [dx, dz] of samples) {
    const cellX = worldToGridX(x + dx);
    const cellZ = worldToGridZ(z + dz);
    const cellSurfaceY = getAvatarSurfaceYForCell(cellX, cellZ);

    if (cellSurfaceY === null) {
      return null;
    }

    surfaceY = Math.max(surfaceY, cellSurfaceY);
  }

  return Number.isFinite(surfaceY) ? surfaceY : null;
}

function resetAvatarToSpawn(): void {
  for (let radius = 0; radius <= 24; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) {
          continue;
        }

        const x = EXPLORE_SPAWN.x + dx;
        const z = EXPLORE_SPAWN.z + dz;
        const worldX = gridToWorldX(x);
        const worldZ = gridToWorldZ(z);
        const surfaceY = getAvatarSurfaceYAtWorld(worldX, worldZ);

        if (surfaceY !== null) {
          avatarGroup.position.set(worldX, surfaceY, worldZ);
          avatarGroup.rotation.y = exploreYaw;
          return;
        }
      }
    }
  }

  avatarGroup.position.set(0.5, 1, -15.5);
}

function ensureAvatarOnWalkableGround(): void {
  const surfaceY = getAvatarSurfaceYAtWorld(avatarGroup.position.x, avatarGroup.position.z);
  if (surfaceY === null) {
    resetAvatarToSpawn();
    return;
  }

  avatarGroup.position.y = surfaceY;
}

function syncExploreYawFromCamera(): void {
  const dx = camera.position.x - avatarGroup.position.x;
  const dz = camera.position.z - avatarGroup.position.z;

  if (Math.abs(dx) + Math.abs(dz) > 0.001) {
    exploreYaw = Math.atan2(dx, dz);
  }
}

function updateExplorePointerDrag(event: PointerEvent): void {
  if (!explorePointerDrag) {
    return;
  }

  const dx = event.clientX - explorePointerDrag.x;
  const dy = event.clientY - explorePointerDrag.y;
  explorePointerDrag = { x: event.clientX, y: event.clientY };

  exploreYaw -= dx * 0.006;
  explorePitch = THREE.MathUtils.clamp(
    explorePitch + dy * 0.004,
    EXPLORE_CAMERA_MIN_PITCH,
    EXPLORE_CAMERA_MAX_PITCH,
  );
}

function normalizeExploreKey(key: string): string | null {
  switch (key.toLowerCase()) {
    case 'w':
    case 'arrowup':
      return 'forward';
    case 's':
    case 'arrowdown':
      return 'back';
    case 'a':
    case 'arrowleft':
      return 'left';
    case 'd':
    case 'arrowright':
      return 'right';
    case 'shift':
      return 'run';
    default:
      return null;
  }
}

function handleExploreKeyDown(event: KeyboardEvent): boolean {
  if (activeTool !== 'explore') {
    return false;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    setTool('orbit');
    showToast('Editor mode');
    return true;
  }

  const exploreKey = normalizeExploreKey(event.key);
  if (exploreKey) {
    event.preventDefault();
    exploreMoveKeys.add(exploreKey);
  }

  return true;
}

function updateExplore(delta: number): void {
  if (activeTool !== 'explore') {
    return;
  }

  const forwardAmount = Number(exploreMoveKeys.has('forward')) - Number(exploreMoveKeys.has('back'));
  const strafeAmount = Number(exploreMoveKeys.has('right')) - Number(exploreMoveKeys.has('left'));
  exploreMoveVector.set(0, 0);

  if (forwardAmount !== 0 || strafeAmount !== 0) {
    const forwardX = -Math.sin(exploreYaw);
    const forwardZ = -Math.cos(exploreYaw);
    const rightX = Math.cos(exploreYaw);
    const rightZ = -Math.sin(exploreYaw);

    exploreMoveVector.set(
      forwardX * forwardAmount + rightX * strafeAmount,
      forwardZ * forwardAmount + rightZ * strafeAmount,
    ).normalize();

    const speed = EXPLORE_WALK_SPEED * (exploreMoveKeys.has('run') ? EXPLORE_RUN_MULTIPLIER : 1);
    moveAvatar(exploreMoveVector.x * speed * delta, exploreMoveVector.y * speed * delta, delta);
    avatarGroup.rotation.y = THREE.MathUtils.lerp(
      avatarGroup.rotation.y,
      Math.atan2(-exploreMoveVector.x, -exploreMoveVector.y),
      Math.min(1, delta * 12),
    );
  }

  updateExploreCamera(delta);
}

function moveAvatar(dx: number, dz: number, delta: number): void {
  const nextX = avatarGroup.position.x + dx;
  let surfaceY = getAvatarSurfaceYAtWorld(nextX, avatarGroup.position.z);

  if (surfaceY !== null) {
    avatarGroup.position.x = nextX;
  }

  const nextZ = avatarGroup.position.z + dz;
  surfaceY = getAvatarSurfaceYAtWorld(avatarGroup.position.x, nextZ);

  if (surfaceY !== null) {
    avatarGroup.position.z = nextZ;
  }

  surfaceY = getAvatarSurfaceYAtWorld(avatarGroup.position.x, avatarGroup.position.z);
  if (surfaceY !== null) {
    avatarGroup.position.y = THREE.MathUtils.lerp(avatarGroup.position.y, surfaceY, Math.min(1, delta * 10));
  }
}

function updateExploreCamera(delta: number): void {
  const targetHeight = 1.55;
  const horizontalDistance = Math.cos(explorePitch) * exploreCameraDistance;
  exploreCameraTarget.set(avatarGroup.position.x, avatarGroup.position.y + targetHeight, avatarGroup.position.z);
  exploreDesiredCameraPosition.set(
    avatarGroup.position.x + Math.sin(exploreYaw) * horizontalDistance,
    avatarGroup.position.y + Math.sin(explorePitch) * exploreCameraDistance + 1.8,
    avatarGroup.position.z + Math.cos(exploreYaw) * horizontalDistance,
  );

  camera.position.lerp(exploreDesiredCameraPosition, Math.min(1, delta * 9));
  camera.lookAt(exploreCameraTarget);
}

function snapshot(): VoxelSnapshot {
  return Array.from(voxelData.entries());
}

function restore(snapshotData: VoxelSnapshot): void {
  voxelData.clear();
  for (const [key, type] of snapshotData) {
    voxelData.set(key, type);
  }
  rebuildScene();
  updateUi();
}

function applyWithHistory(mutator: () => boolean): void {
  const before = snapshot();
  const changed = mutator();

  if (!changed) {
    return;
  }

  undoStack.push(before);
  redoStack.length = 0;
  rebuildScene();
  updateUi();
}

function undo(): void {
  const previous = undoStack.pop();
  if (!previous) {
    return;
  }

  redoStack.push(snapshot());
  restore(previous);
  showToast('Undone');
}

function redo(): void {
  const next = redoStack.pop();
  if (!next) {
    return;
  }

  undoStack.push(snapshot());
  restore(next);
  showToast('Redone');
}

function riverCenterAt(x: number): number {
  return GRID_SIZE * 0.64 + Math.sin((x - 5) * 0.18) * 4.2 + Math.sin(x * 0.055) * 1.5;
}

function isRiver(x: number, z: number): boolean {
  return Math.abs(z - riverCenterAt(x)) <= 3.15;
}

function isPark(x: number, z: number): boolean {
  const hydePark = x >= 4 && x <= 20 && z >= 5 && z <= 18;
  const greenPark = x >= 21 && x <= 31 && z >= 17 && z <= 25;
  const gardenSquare = x >= 46 && x <= 57 && z >= 8 && z <= 18;
  const eastPark = x >= 52 && x <= 66 && z >= 52 && z <= 65;
  return hydePark || greenPark || gardenSquare || eastPark;
}

function isRoad(x: number, z: number): boolean {
  if (isRiver(x, z)) {
    return false;
  }

  const verticalRoad = isNearAny(x, [10, 24, 38, 54, 64], 1);
  const horizontalRoad = isNearAny(z, [12, 24, 36, 50, 62], 1);
  return verticalRoad || horizontalRoad;
}

function isNearAny(value: number, stops: number[], radius: number): boolean {
  return stops.some((stop) => Math.abs(value - stop) <= radius);
}

function addGroundLayers(x: number, z: number): void {
  setVoxel(x, -1, z, 'soil');
  setVoxel(x, -2, z, 'soil');
}

function createNewMap(): void {
  applyWithHistory(() => {
    generateNewMap();
    return true;
  });
  applyControlMode(activeTool);
  buildAssetGrid();
  updateUi();
  showToast('New cozy map created');
}

function generateNewMap(): void {
  generateCleanMap();
}

function generateCleanMap(): void {
  voxelData.clear();
  activeCategory = 'terrain';
  selectedType = 'grass';
  selectedPresetId = null;
  activeTool = 'paint';
  presetRotation = 0;

  for (let x = 0; x < GRID_SIZE; x += 1) {
    for (let z = 0; z < GRID_SIZE; z += 1) {
      addGroundLayers(x, z);
      setVoxel(x, 0, z, 'grass');
    }
  }

  addInitialWaterFeatures();

  const treeCells: Array<[number, number, VoxelType]> = activeTheme === 'japanese'
    ? [
        [17, 18, 'sakura'],
        [33, 66, 'leaf'],
        [54, 28, 'sakura'],
        [74, 70, 'sakura'],
        [80, 24, 'leaf'],
      ]
    : [
        [16, 18, 'leaf'],
        [30, 72, 'leaf'],
        [52, 30, 'leaf'],
        [71, 67, 'leaf'],
        [80, 22, 'leaf'],
      ];

  for (const [x, z, leafType] of treeCells) {
    addSimpleTree(x, z, leafType);
  }

  resetAvatarToSpawn();
}

function addInitialWaterFeatures(): void {
  for (let x = 0; x < GRID_SIZE; x += 1) {
    for (let z = 0; z < GRID_SIZE; z += 1) {
      if (isInitialWater(x, z)) {
        setVoxel(x, 0, z, 'water');
      }
    }
  }
}

function initialRiverCenterAt(x: number): number {
  return GRID_SIZE * 0.55 + Math.sin((x + 8) * 0.13) * 5.2 + Math.sin(x * 0.045) * 3.1;
}

function initialRiverWidthAt(x: number): number {
  return 2.55 + Math.sin((x + 2) * 0.09) * 0.5;
}

function isInitialRiver(x: number, z: number): boolean {
  return Math.abs(z - initialRiverCenterAt(x)) <= initialRiverWidthAt(x);
}

function isInitialWater(x: number, z: number): boolean {
  return isInitialRiver(x, z);
}

function addSimpleTree(x: number, z: number, leafType: VoxelType): void {
  setVoxel(x, 1, z, 'wood');
  setVoxel(x, 2, z, 'wood');
  setVoxel(x, 3, z, 'wood');

  for (let dx = -2; dx <= 2; dx += 1) {
    for (let dz = -2; dz <= 2; dz += 1) {
      const distance = Math.abs(dx) + Math.abs(dz);
      if (distance <= 3) {
        setVoxel(x + dx, 4, z + dz, leafType);
      }
      if (distance <= 2) {
        setVoxel(x + dx, 5, z + dz, leafType);
      }
    }
  }

  setVoxel(x, 6, z, leafType);
}

function generateLondonBaseMap(): void {
  voxelData.clear();

  for (let x = 0; x < GRID_SIZE; x += 1) {
    for (let z = 0; z < GRID_SIZE; z += 1) {
      addGroundLayers(x, z);

      if (isRiver(x, z)) {
        setVoxel(x, 0, z, 'water');
      } else if (isPark(x, z)) {
        setVoxel(x, 0, z, 'grass');
      } else {
        setVoxel(x, 0, z, 'pavement');
      }
    }
  }
}

function generateJapaneseBaseMap(): void {
  voxelData.clear();
  const canalX = Math.round(GRID_SIZE * 0.48);
  const canalZ = Math.round(GRID_SIZE * 0.62);

  for (let x = 0; x < GRID_SIZE; x += 1) {
    for (let z = 0; z < GRID_SIZE; z += 1) {
      addGroundLayers(x, z);

      const canal = Math.abs(x - canalX) <= 1 || Math.abs(z - canalZ) <= 1;
      const stoneEdge = (x + z) % 11 === 0 && (Math.abs(x - canalX) <= 4 || Math.abs(z - canalZ) <= 4);

      if (canal) {
        setVoxel(x, 0, z, 'water');
      } else if (stoneEdge) {
        setVoxel(x, 0, z, 'pavement');
      } else {
        setVoxel(x, 0, z, 'grass');
      }
    }
  }

  for (let x = canalX - 3; x <= canalX + 3; x += 1) {
    setVoxel(x, 1, canalZ - 1, 'wood');
    setVoxel(x, 1, canalZ + 1, 'wood');
  }

  for (let z = canalZ - 2; z <= canalZ + 2; z += 1) {
    setVoxel(canalX - 1, 1, z, 'wood');
    setVoxel(canalX + 1, 1, z, 'wood');
  }
}

function generateLondonCity(): void {
  generateLondonBaseMap();

  addTerraces();
  addCommercialBlocks();
  addWestminster();
  addTowerBridge();
  addLondonEye();
  addShard();
  addStPauls();
  addVehicles();
  addStationsAndLamps();
  addTrees();
}

function addTerraces(): void {
  for (let x = 3; x <= GRID_SIZE - 12; x += 6) {
    addBuilding(x, 17, 4, 4, 4 + (x % 3), 'brick', 'roof');
    addBuilding(x, 28, 4, 4, 4 + ((x + 1) % 3), 'brick', 'roof');
  }

  for (let z = 4; z <= GRID_SIZE - 14; z += 7) {
    addBuilding(13, z, 4, 4, 4 + (z % 2), 'brick', 'roof');
    addBuilding(42, z, 5, 4, 5 + (z % 3), 'brick', 'roof');
    addBuilding(58, z, 5, 4, 4 + (z % 2), 'stone', 'roof');
  }
}

function addCommercialBlocks(): void {
  addBuilding(25, 4, 4, 4, 6, 'glass', 'roof');
  addBuilding(30, 4, 4, 4, 5, 'stone', 'roof');
  addBuilding(40, 14, 5, 4, 6, 'glass', 'roof');
  addBuilding(27, 21, 4, 4, 5, 'brick', 'roof');
  addBuilding(31, 23, 4, 4, 7, 'glass', 'roof');
  addBuilding(3, 34, 5, 4, 5, 'brick', 'roof');
  addBuilding(8, 38, 4, 4, 4, 'stone', 'roof');
  addBuilding(18, 39, 4, 5, 6, 'glass', 'roof');
  addBuilding(31, 39, 4, 4, 5, 'brick', 'roof');
  addBuilding(39, 39, 5, 5, 6, 'glass', 'roof');
  addBuilding(50, 4, 6, 5, 8, 'glass', 'roof');
  addBuilding(59, 7, 5, 5, 7, 'stone', 'roof');
  addBuilding(49, 27, 6, 5, 9, 'glass', 'roof');
  addBuilding(58, 39, 6, 6, 8, 'brick', 'roof');
  addBuilding(47, 58, 5, 5, 6, 'stone', 'roof');
}

function addWestminster(): void {
  addBuilding(16, 23, 13, 4, 4, 'stone', 'roof');
  addTower(15, 22, 3, 3, 12, 'stone');
  addTower(27, 22, 2, 2, 7, 'stone');

  for (let x = 17; x <= 27; x += 2) {
    setVoxel(x, 5, 22, 'landmark');
    setVoxel(x, 6, 22, 'stone');
  }

  setVoxel(16, 10, 21, 'landmark');
  setVoxel(17, 10, 21, 'landmark');
  setVoxel(15, 10, 23, 'landmark');
  setVoxel(15, 10, 24, 'landmark');
  setVoxel(16, 13, 23, 'roof');
  setVoxel(17, 13, 23, 'roof');
}

function addTowerBridge(): void {
  const bridgeX = Math.round(GRID_SIZE * 0.73);
  const centerZ = Math.round(riverCenterAt(bridgeX));

  for (let z = centerZ - 6; z <= centerZ + 6; z += 1) {
    addCuboid(bridgeX - 1, 1, z, 3, 1, 1, 'road');
    setVoxel(bridgeX - 2, 2, z, 'iron');
    setVoxel(bridgeX + 2, 2, z, 'iron');
  }

  addTower(bridgeX - 3, centerZ - 7, 3, 3, 7, 'stone');
  addTower(bridgeX + 1, centerZ - 7, 3, 3, 7, 'stone');
  addTower(bridgeX - 3, centerZ + 5, 3, 3, 7, 'stone');
  addTower(bridgeX + 1, centerZ + 5, 3, 3, 7, 'stone');

  for (let x = bridgeX - 2; x <= bridgeX + 2; x += 1) {
    for (let z = centerZ - 6; z <= centerZ + 6; z += 1) {
      if (z % 2 === 0) {
        setVoxel(x, 6, z, 'iron');
      }
    }
  }
}

function addLondonEye(): void {
  const centerX = 15;
  const centerY = 7;
  const z = Math.round(riverCenterAt(centerX)) - 5;
  const radius = 5;

  for (let angle = 0; angle < 360; angle += 12) {
    const radians = THREE.MathUtils.degToRad(angle);
    const x = Math.round(centerX + Math.cos(radians) * radius);
    const y = Math.round(centerY + Math.sin(radians) * radius);
    setVoxel(x, y, z, angle % 36 === 0 ? 'lamp' : 'iron');
  }

  for (let angle = 0; angle < 360; angle += 45) {
    const radians = THREE.MathUtils.degToRad(angle);
    for (let step = 0; step <= radius; step += 1) {
      const x = Math.round(centerX + Math.cos(radians) * step);
      const y = Math.round(centerY + Math.sin(radians) * step);
      setVoxel(x, y, z, 'iron');
    }
  }

  setVoxel(centerX, centerY, z, 'landmark');
  addCuboid(centerX - 2, 1, z, 5, 1, 1, 'iron');
  addCuboid(centerX - 1, 2, z, 3, 1, 1, 'iron');
}

function addShard(): void {
  const centerX = 43;
  const centerZ = Math.round(riverCenterAt(43)) + 7;

  for (let y = 1; y <= 15; y += 1) {
    const radius = Math.max(1, Math.round(5 - y * 0.28));
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      for (let z = centerZ - radius; z <= centerZ + radius; z += 1) {
        const distance = Math.abs(x - centerX) + Math.abs(z - centerZ);
        if (distance <= radius + 1) {
          setVoxel(x, y, z, y > 12 ? 'glass' : 'stone');
        }
      }
    }
  }

  setVoxel(centerX, 16, centerZ, 'glass');
}

function addStPauls(): void {
  addBuilding(36, 14, 8, 6, 5, 'stone', 'roof');

  const centerX = 40;
  const centerZ = 17;
  for (let y = 5; y <= 8; y += 1) {
    const radius = 9 - y;
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      for (let z = centerZ - radius; z <= centerZ + radius; z += 1) {
        if (Math.hypot(x - centerX, z - centerZ) <= radius) {
          setVoxel(x, y, z, y === 8 ? 'landmark' : 'stone');
        }
      }
    }
  }
}

function addVehicles(): void {
  addBus(8, 1, 18, true);
  addBus(35, 1, 25, false);
  addBus(22, 1, 9, true);
  addBus(54, 1, 35, false);
  addBus(63, 1, 49, true);
  addCab(23, 1, 29);
  addCab(10, 1, 27);
  addCab(36, 1, 14);
  addCab(53, 1, 12);
  addCab(64, 1, 62);
}

function addStationsAndLamps(): void {
  const stationCells: Array<[number, number]> = [
    [9, 10],
    [23, 19],
    [36, 27],
    [16, 20],
    [31, 10],
    [54, 36],
    [64, 50],
    [38, 62],
  ];

  for (const [x, z] of stationCells) {
    setVoxel(x, 1, z, 'underground');
    setVoxel(x, 2, z, 'bus');
    setVoxel(x, 3, z, 'underground');
  }

  for (let x = 4; x < GRID_SIZE - 3; x += 5) {
    for (const z of [11, 23, 35, 49, 61]) {
      if (!isRiver(x, z)) {
        setVoxel(x, 1, z + 2, 'iron');
        setVoxel(x, 2, z + 2, 'lamp');
      }
    }
  }
}

function addTrees(): void {
  const treeCells: Array<[number, number]> = [
    [5, 6],
    [8, 8],
    [12, 6],
    [6, 12],
    [13, 12],
    [16, 16],
    [19, 18],
    [31, 9],
    [34, 11],
    [49, 11],
    [55, 14],
    [60, 57],
    [65, 62],
  ];

  for (let x = 6; x < GRID_SIZE - 5; x += 8) {
    for (let z = 6; z < GRID_SIZE - 5; z += 8) {
      if (isPark(x, z) && !isRoad(x, z) && !isRiver(x, z)) {
        treeCells.push([x, z]);
      }
    }
  }

  for (const [x, z] of treeCells) {
    setVoxel(x, 1, z, 'wood');
    setVoxel(x, 2, z, 'wood');
    setVoxel(x, 3, z, 'wood');
    for (let dx = -2; dx <= 2; dx += 1) {
      for (let dz = -2; dz <= 2; dz += 1) {
        if (Math.abs(dx) + Math.abs(dz) <= 3) {
          setVoxel(x + dx, 4, z + dz, 'leaf');
        }
        if (Math.abs(dx) + Math.abs(dz) <= 2) {
          setVoxel(x + dx, 5, z + dz, 'leaf');
        }
      }
    }
    setVoxel(x, 6, z, 'leaf');
  }
}

function addBuilding(
  startX: number,
  startZ: number,
  width: number,
  depth: number,
  height: number,
  wall: VoxelType,
  roof: VoxelType,
): void {
  if (!canBuild(startX, startZ, width, depth)) {
    return;
  }

  for (let x = startX; x < startX + width; x += 1) {
    for (let z = startZ; z < startZ + depth; z += 1) {
      for (let y = 1; y <= height; y += 1) {
        const edge = x === startX || x === startX + width - 1 || z === startZ || z === startZ + depth - 1;
        const windowBay = edge && y > 1 && y < height && (x + z + y) % 3 === 0;
        setVoxel(x, y, z, windowBay ? 'window' : wall);
      }
      setVoxel(x, height + 1, z, roof);
    }
  }
}

function addTower(startX: number, startZ: number, width: number, depth: number, height: number, type: VoxelType): void {
  for (let x = startX; x < startX + width; x += 1) {
    for (let z = startZ; z < startZ + depth; z += 1) {
      for (let y = 1; y <= height; y += 1) {
        const crown = y === height || y === height - 1;
        setVoxel(x, y, z, crown ? 'landmark' : type);
      }
    }
  }

  const middleX = startX + Math.floor(width / 2);
  const middleZ = startZ + Math.floor(depth / 2);
  setVoxel(middleX, height + 1, middleZ, 'roof');
}

function addCuboid(startX: number, startY: number, startZ: number, width: number, height: number, depth: number, type: VoxelType): void {
  for (let x = startX; x < startX + width; x += 1) {
    for (let y = startY; y < startY + height; y += 1) {
      for (let z = startZ; z < startZ + depth; z += 1) {
        setVoxel(x, y, z, type);
      }
    }
  }
}

function addBus(x: number, y: number, z: number, alongZ: boolean): void {
  const width = alongZ ? 2 : 4;
  const depth = alongZ ? 4 : 2;
  addCuboid(x, y, z, width, 2, depth, 'bus');
  addCuboid(x, y + 2, z, width, 1, depth, 'glass');
  setVoxel(x, y, z, 'cab');
  setVoxel(x + width - 1, y, z + depth - 1, 'cab');
}

function addCab(x: number, y: number, z: number): void {
  addCuboid(x, y, z, 2, 1, 2, 'cab');
  setVoxel(x, y + 1, z, 'glass');
  setVoxel(x + 1, y + 1, z + 1, 'glass');
}

function canBuild(startX: number, startZ: number, width: number, depth: number): boolean {
  for (let x = startX; x < startX + width; x += 1) {
    for (let z = startZ; z < startZ + depth; z += 1) {
      if (!isInBounds(x, 1, z) || isRiver(x, z) || isRoad(x, z)) {
        return false;
      }
    }
  }
  return true;
}

function rebuildScene(): void {
  for (const child of [...voxelGroup.children]) {
    voxelGroup.remove(child);
    if (child instanceof THREE.InstancedMesh) {
      child.dispose();
    }
  }

  renderLookup.length = 0;

  const byMaterial = new Map<string, { type: VoxelType; shade: number; voxels: Voxel[] }>();
  const lightVoxels: Voxel[] = [];
  for (const [key, type] of voxelData.entries()) {
    const [x, y, z] = parseKey(key);
    const voxel = { x, y, z, type };
    const shade = getVoxelShadeBucket(voxel);
    const materialKey = `${type}:${shade}`;
    const bucket = byMaterial.get(materialKey) ?? { type, shade, voxels: [] };
    bucket.voxels.push(voxel);
    byMaterial.set(materialKey, bucket);

    const shouldAddLight = type === 'lamp' || (type === 'window' && deterministicNoise(x, y, z, type) > 0.18);
    if (isPointLightVoxel(type) && lightVoxels.length < MAX_SCENE_LIGHTS && shouldAddLight) {
      lightVoxels.push(voxel);
    }
  }

  for (const { type, shade, voxels } of byMaterial.values()) {
    const mesh = new THREE.InstancedMesh(baseGeometry, getMaterial(type, shade), voxels.length);
    mesh.castShadow = type !== 'water';
    mesh.receiveShadow = true;
    mesh.userData.voxels = voxels;

    voxels.forEach((voxel, index) => {
      worldMatrix.makeTranslation(voxel.x - HALF_GRID + 0.5, voxel.y + 0.5, voxel.z - HALF_GRID + 0.5);
      mesh.setMatrixAt(index, worldMatrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    voxelGroup.add(mesh);
    renderLookup.push(mesh);
  }

  renderLookup.push(groundPlane);
  rebuildVoxelLights(lightVoxels);
  if (activeTool === 'explore') {
    ensureAvatarOnWalkableGround();
  }
  updateHover();
}

function isPointLightVoxel(type: VoxelType): boolean {
  return type === 'lamp' || type === 'window';
}

function rebuildVoxelLights(lightVoxels: Voxel[]): void {
  for (const child of [...lampLightGroup.children]) {
    lampLightGroup.remove(child);
    if (child instanceof THREE.Sprite) {
      child.material.dispose();
    }
  }

  for (const voxel of lightVoxels) {
    const isWindow = voxel.type === 'window';
    const color = isWindow ? 0xffb45e : 0xffdc83;
    const light = new THREE.PointLight(color, isWindow ? 0.9 : 1.55, isWindow ? 11 : 14, 1.82);
    light.position.set(voxel.x - HALF_GRID + 0.5, voxel.y + 0.5, voxel.z - HALF_GRID + 0.5);
    lampLightGroup.add(light);

    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity: isWindow ? 0.28 : 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowSprite = new THREE.Sprite(glowMaterial);
    glowSprite.position.copy(light.position);
    glowSprite.scale.setScalar(isWindow ? 4.1 : 5.8);
    glowSprite.renderOrder = 3;
    lampLightGroup.add(glowSprite);
  }

  lampLightGroup.visible = nightModeEnabled;
}

function getMaterial(type: VoxelType, shade = 4): THREE.MeshStandardMaterial {
  const key = `${type}:${shade}`;
  const cached = materials.get(key);
  if (cached) {
    return cached;
  }

  const info = BLOCKS[type];
  const material = new THREE.MeshStandardMaterial({
    color: getShadedBlockColor(type, shade),
    roughness: info.roughness ?? 0.72,
    metalness: info.metalness ?? 0,
    transparent: info.transparent ?? false,
    opacity: info.opacity ?? 1,
    emissive: getEmissiveColor(type),
    emissiveIntensity: getEmissiveIntensity(type),
  });
  materials.set(key, material);
  return material;
}

function getEmissiveColor(type: VoxelType): THREE.Color {
  if (type === 'lamp' || type === 'window') {
    return new THREE.Color(type === 'window' ? 0xffb24f : 0xffd36d);
  }

  if (type === 'glass') {
    return new THREE.Color(0x77caff);
  }

  if (type === 'landmark' || type === 'underground') {
    return new THREE.Color(type === 'underground' ? 0x2d6cff : 0xf3c75b);
  }

  return new THREE.Color(0x000000);
}

function getEmissiveIntensity(type: VoxelType): number {
  if (type === 'lamp') {
    return nightModeEnabled ? 2.8 : 0.34;
  }

  if (type === 'window') {
    return nightModeEnabled ? 2.15 : 0.2;
  }

  if (type === 'glass') {
    return nightModeEnabled ? 0.48 : 0;
  }

  if (type === 'landmark' || type === 'underground') {
    return nightModeEnabled ? 0.86 : 0.05;
  }

  return 0;
}

function syncMaterialGlow(): void {
  for (const [key, material] of materials.entries()) {
    const [type] = key.split(':') as [VoxelType, string];
    material.emissive.copy(getEmissiveColor(type));
    material.emissiveIntensity = getEmissiveIntensity(type);
    material.needsUpdate = true;
  }
}

function getVoxelShadeBucket(voxel: Voxel): number {
  const noise = deterministicNoise(voxel.x, voxel.y, voxel.z, voxel.type);
  let bucket = Math.floor(noise * SHADE_AMOUNTS.length);

  if (voxel.y === 0 && (voxel.type === 'road' || voxel.type === 'pavement')) {
    bucket -= 1;
  }

  if (voxel.y >= 5) {
    bucket += 1;
  }

  return THREE.MathUtils.clamp(bucket, 0, SHADE_AMOUNTS.length - 1);
}

function getShadedBlockColor(type: VoxelType, shade: number): THREE.Color {
  const color = new THREE.Color(BLOCKS[type].color);
  const dampening = type === 'water' || type === 'glass' || type === 'window' ? 0.45 : 1;
  const amount = SHADE_AMOUNTS[shade] * dampening;
  color.lerp(new THREE.Color(amount < 0 ? 0x000000 : 0xffffff), Math.abs(amount));
  return color;
}

function deterministicNoise(x: number, y: number, z: number, type: VoxelType): number {
  let hash = 2166136261;
  const value = `${type}:${x}:${y}:${z}`;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

function updatePointer(event: PointerEvent): void {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function updateHover(): void {
  if (!pointerInCanvas) {
    return;
  }

  if (activeTool === 'pan' || activeTool === 'orbit' || activeTool === 'zoom' || activeTool === 'explore') {
    previewMesh.visible = false;
    presetPreviewGroup.visible = false;
    return;
  }

  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(renderLookup, false)[0];
  hoverVoxel = hit ? targetFromIntersection(hit, activeTool, replaceTargetMode) : null;

  if (!hoverVoxel || !isInBounds(hoverVoxel.x, hoverVoxel.y, hoverVoxel.z)) {
    previewMesh.visible = false;
    presetPreviewGroup.visible = false;
    return;
  }

  const preset = getSelectedPreset();
  if (activeTool === 'stamp' && preset) {
    previewMesh.visible = false;
    presetPreviewGroup.visible = true;
    presetPreviewGroup.position.set(hoverVoxel.x - HALF_GRID, hoverVoxel.y, hoverVoxel.z - HALF_GRID);
    return;
  }

  presetPreviewGroup.visible = false;
  previewMesh.visible = true;
  previewMesh.position.set(hoverVoxel.x - HALF_GRID + 0.5, hoverVoxel.y + 0.5, hoverVoxel.z - HALF_GRID + 0.5);
  previewMaterial.color.set(activeTool === 'erase' ? 0xff3b3b : BLOCKS[selectedType].color);
}

function targetFromIntersection(intersection: THREE.Intersection, tool: Tool, replaceTarget = false): Voxel | null {
  if (intersection.object.userData.isGround) {
    const x = Math.floor(intersection.point.x + HALF_GRID);
    const z = Math.floor(intersection.point.z + HALF_GRID);
    return isInBounds(x, 0, z) ? { x, y: 0, z, type: selectedType } : null;
  }

  const instanceId = intersection.instanceId;
  const voxels = intersection.object.userData.voxels as Voxel[] | undefined;
  if (instanceId === undefined || !voxels?.[instanceId]) {
    return null;
  }

  const voxel = voxels[instanceId];
  if (tool === 'erase' || tool === 'sample') {
    return { ...voxel };
  }

  if (replaceTarget && (tool === 'paint' || tool === 'stamp')) {
    return { ...voxel, type: selectedType };
  }

  const normal = intersection.face?.normal ?? new THREE.Vector3(0, 1, 0);
  return {
    x: voxel.x + Math.round(normal.x),
    y: voxel.y + Math.round(normal.y),
    z: voxel.z + Math.round(normal.z),
    type: selectedType,
  };
}

function applyPointerEdit(tool: Tool, replaceTarget = false): void {
  if (tool === 'pan' || tool === 'orbit' || tool === 'zoom' || tool === 'explore') {
    return;
  }

  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(renderLookup, false)[0];
  const target = hit ? targetFromIntersection(hit, tool, replaceTarget) : null;

  if (!target || !isInBounds(target.x, target.y, target.z)) {
    return;
  }

  if (tool === 'stamp') {
    const preset = getSelectedPreset();
    if (!preset) {
      return;
    }

    applyWithHistory(() => stampPresetAt(target, preset));
    return;
  }

  if (tool === 'sample') {
    const sampledType = getVoxel(target.x, target.y, target.z);
    if (sampledType) {
      selectedType = sampledType;
      setTool('paint');
      updateUi();
      showToast(BLOCKS[selectedType].label);
    }
    return;
  }

  applyWithHistory(() => {
    let changed = false;
    const radius = Math.floor(brushSize / 2);

    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        const x = target.x + dx;
        const z = target.z + dz;

        if (!isInBounds(x, target.y, z)) {
          continue;
        }

        if (tool === 'erase') {
          changed = removeVoxel(x, target.y, z) || changed;
        } else {
          changed = setVoxel(x, target.y, z, selectedType) || changed;
        }
      }
    }

    return changed;
  });
}

function stampPresetAt(anchor: Voxel, preset: ObjectPreset): boolean {
  let changed = false;

  for (const voxel of getRotatedPresetVoxels(preset)) {
    const x = anchor.x + voxel.dx;
    const y = anchor.y + voxel.dy;
    const z = anchor.z + voxel.dz;
    changed = setVoxel(x, y, z, voxel.type) || changed;
  }

  return changed;
}

function getRotatedPresetVoxels(preset: ObjectPreset): PresetVoxel[] {
  if (presetRotation === 0) {
    return preset.voxels;
  }

  const bounds = getPresetBounds(preset.voxels);
  const width = bounds.maxX - bounds.minX + 1;
  const depth = bounds.maxZ - bounds.minZ + 1;
  const rotated = preset.voxels.map((voxel) => {
    const x = voxel.dx - bounds.minX;
    const z = voxel.dz - bounds.minZ;

    if (presetRotation === 1) {
      return { ...voxel, dx: depth - 1 - z, dz: x };
    }

    if (presetRotation === 2) {
      return { ...voxel, dx: width - 1 - x, dz: depth - 1 - z };
    }

    return { ...voxel, dx: z, dz: width - 1 - x };
  });

  return uniquePresetVoxels(rotated);
}

function getPresetBounds(voxels: PresetVoxel[]): { minX: number; maxX: number; minZ: number; maxZ: number } {
  return voxels.reduce(
    (bounds, voxel) => ({
      minX: Math.min(bounds.minX, voxel.dx),
      maxX: Math.max(bounds.maxX, voxel.dx),
      minZ: Math.min(bounds.minZ, voxel.dz),
      maxZ: Math.max(bounds.maxZ, voxel.dz),
    }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
  );
}

function buildThemeTabs(): void {
  themeTabs.innerHTML = '';

  for (const theme of PRESET_THEMES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-tab';
    button.textContent = theme.label;
    button.setAttribute('role', 'tab');
    button.dataset.theme = theme.id;
    button.addEventListener('click', () => {
      activeTheme = theme.id;
      if (getSelectedPreset()?.theme !== activeTheme) {
        selectedPresetId = null;
        activeTool = 'paint';
        rebuildPresetPreview();
      }
      buildAssetGrid();
      updateUi();
      updateHover();
    });
    themeTabs.append(button);
  }
}

function buildCategoryTabs(): void {
  categoryTabs.innerHTML = '';

  for (const category of CATALOG_CATEGORIES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-tab';
    button.textContent = category.label;
    button.setAttribute('role', 'tab');
    button.dataset.category = category.id;
    button.addEventListener('click', () => {
      activeCategory = category.id;
      buildAssetGrid();
      updateUi();
    });
    categoryTabs.append(button);
  }
}

function buildAssetGrid(): void {
  assetGrid.innerHTML = '';

  for (const item of getCatalogItems().filter((entry) => entry.category === activeCategory)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'asset-card';
    button.dataset.asset = item.id;
    button.title = item.label;
    button.setAttribute('aria-label', item.label);

    const label = document.createElement('span');
    label.className = 'asset-label';
    label.textContent = item.label;

    button.append(buildAssetThumb(item), label);
    button.addEventListener('click', () => selectCatalogItem(item));
    assetGrid.append(button);
  }
}

function getCatalogItems(): CatalogItem[] {
  const presetItems = OBJECT_PRESETS.filter((preset) => preset.theme === activeTheme).map(presetToCatalogItem);
  return [...BLOCK_CATALOG, ...presetItems];
}

function presetToCatalogItem(preset: ObjectPreset): CatalogItem {
  return {
    id: `preset-${preset.id}`,
    category: categoryForPreset(preset.category),
    kind: 'preset',
    label: preset.label,
    swatches: preset.swatches,
    presetId: preset.id,
  };
}

function categoryForPreset(category: string): CatalogCategory {
  if (category === 'Terrain' || category === 'Ground Styles') {
    return 'terrain';
  }
  if (category === 'Vegetation' || category === 'Gardens') {
    return 'nature';
  }
  if (category === 'Buildings' || category === 'Landmarks' || category === 'Shrines') {
    return 'structures';
  }
  if (category === 'Street Props' || category === 'Lighting' || category === 'Borders' || category === 'Ornaments' || category === 'Furniture') {
    return 'decor';
  }
  return 'utility';
}

function buildAssetThumb(item: CatalogItem): SVGSVGElement {
  if (item.kind === 'block' && item.blockType) {
    return buildVoxelSvgThumb([presetVoxel(0, 0, 0, item.blockType)]);
  }

  const preset = item.presetId ? OBJECT_PRESETS.find((entry) => entry.id === item.presetId) : null;
  return buildVoxelSvgThumb(preset?.voxels ?? [presetVoxel(0, 0, 0, 'stone')]);
}

function buildVoxelSvgThumb(voxels: PresetVoxel[]): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('asset-thumb', 'asset-svg');
  svg.setAttribute('viewBox', '0 0 96 68');
  svg.setAttribute('aria-hidden', 'true');

  const points = voxels.flatMap((voxel) => getVoxelCorners(voxel).map(([x, y, z]) => projectThumbPoint(x, y, z)));
  const bounds = points.reduce(
    (box, point) => ({
      minX: Math.min(box.minX, point.x),
      maxX: Math.max(box.maxX, point.x),
      minY: Math.min(box.minY, point.y),
      maxY: Math.max(box.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min(84 / width, 58 / height);
  const offsetX = 48 - ((bounds.minX + bounds.maxX) / 2) * scale;
  const offsetY = 36 - ((bounds.minY + bounds.maxY) / 2) * scale;

  const occupancy = new Set(voxels.map((voxel) => `${voxel.dx},${voxel.dy},${voxel.dz}`));
  const sortedVoxels = [...voxels].sort((a, b) => a.dx + a.dz + a.dy * 2 - (b.dx + b.dz + b.dy * 2));
  for (const voxel of sortedVoxels) {
    drawThumbCube(svg, voxel, occupancy, scale, offsetX, offsetY);
  }

  return svg;
}

function getVoxelCorners(voxel: PresetVoxel): Array<[number, number, number]> {
  return [
    [voxel.dx, voxel.dy, voxel.dz],
    [voxel.dx + 1, voxel.dy, voxel.dz],
    [voxel.dx, voxel.dy, voxel.dz + 1],
    [voxel.dx + 1, voxel.dy, voxel.dz + 1],
    [voxel.dx, voxel.dy + 1, voxel.dz],
    [voxel.dx + 1, voxel.dy + 1, voxel.dz],
    [voxel.dx, voxel.dy + 1, voxel.dz + 1],
    [voxel.dx + 1, voxel.dy + 1, voxel.dz + 1],
  ];
}

function projectThumbPoint(x: number, y: number, z: number): { x: number; y: number } {
  return {
    x: (x - z) * 12,
    y: (x + z) * 6 - y * 10,
  };
}

function drawThumbCube(
  svg: SVGSVGElement,
  voxel: PresetVoxel,
  occupancy: Set<string>,
  scale: number,
  offsetX: number,
  offsetY: number,
): void {
  const color = BLOCKS[voxel.type].color;
  const faces = [
    {
      neighbor: `${voxel.dx + 1},${voxel.dy},${voxel.dz}`,
      points: [
        [voxel.dx + 1, voxel.dy, voxel.dz],
        [voxel.dx + 1, voxel.dy + 1, voxel.dz],
        [voxel.dx + 1, voxel.dy + 1, voxel.dz + 1],
        [voxel.dx + 1, voxel.dy, voxel.dz + 1],
      ],
      fill: shadeThumbColor(color, -0.08),
    },
    {
      neighbor: `${voxel.dx},${voxel.dy},${voxel.dz + 1}`,
      points: [
        [voxel.dx, voxel.dy, voxel.dz + 1],
        [voxel.dx, voxel.dy + 1, voxel.dz + 1],
        [voxel.dx + 1, voxel.dy + 1, voxel.dz + 1],
        [voxel.dx + 1, voxel.dy, voxel.dz + 1],
      ],
      fill: shadeThumbColor(color, -0.22),
    },
    {
      neighbor: `${voxel.dx},${voxel.dy + 1},${voxel.dz}`,
      points: [
        [voxel.dx, voxel.dy + 1, voxel.dz],
        [voxel.dx + 1, voxel.dy + 1, voxel.dz],
        [voxel.dx + 1, voxel.dy + 1, voxel.dz + 1],
        [voxel.dx, voxel.dy + 1, voxel.dz + 1],
      ],
      fill: shadeThumbColor(color, 0.22),
    },
  ];

  for (const face of faces) {
    if (occupancy.has(face.neighbor)) {
      continue;
    }

    const polygon = document.createElementNS(SVG_NS, 'polygon');
    const points = face.points
      .map(([x, y, z]) => projectThumbPoint(x, y, z))
      .map((point) => `${(point.x * scale + offsetX).toFixed(2)},${(point.y * scale + offsetY).toFixed(2)}`)
      .join(' ');
    polygon.setAttribute('points', points);
    polygon.setAttribute('fill', face.fill);
    polygon.setAttribute('stroke', 'rgba(52, 45, 38, 0.14)');
    polygon.setAttribute('stroke-width', '0.7');
    polygon.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.append(polygon);
  }
}

function shadeThumbColor(color: number, amount: number): string {
  const mixed = new THREE.Color(color);
  mixed.lerp(new THREE.Color(amount >= 0 ? 0xffffff : 0x000000), Math.abs(amount));
  return `#${mixed.getHexString()}`;
}

function selectCatalogItem(item: CatalogItem): void {
  if (item.kind === 'block' && item.blockType) {
    selectedType = item.blockType;
    setTool('paint');
    return;
  }

  if (item.kind === 'preset' && item.presetId) {
    selectPreset(item.presetId);
  }
}

function selectPreset(presetId: string): void {
  selectedPresetId = presetId;
  activeTool = 'stamp';
  rebuildPresetPreview();
  updateUi();
  updateHover();
}

function getSelectedPreset(): ObjectPreset | null {
  return OBJECT_PRESETS.find((preset) => preset.id === selectedPresetId) ?? null;
}

function rotateSelectedPreset(): void {
  const preset = getSelectedPreset();
  if (!preset) {
    showToast('Choose an object to rotate');
    return;
  }

  presetRotation = ((presetRotation + 1) % 4) as PresetRotation;
  rebuildPresetPreview();
  updateUi();
  updateHover();
  showToast(`${preset.label} ${presetRotation * 90} degrees`);
}

function rebuildPresetPreview(): void {
  for (const child of [...presetPreviewGroup.children]) {
    presetPreviewGroup.remove(child);
    if (child instanceof THREE.Mesh) {
      const material = child.material;
      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else {
        material.dispose();
      }
    }
  }

  const preset = getSelectedPreset();
  if (!preset) {
    presetPreviewGroup.visible = false;
    return;
  }

  for (const voxel of getRotatedPresetVoxels(preset)) {
    const material = new THREE.MeshBasicMaterial({
      color: BLOCKS[voxel.type].color,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(baseGeometry, material);
    mesh.position.set(voxel.dx + 0.5, voxel.dy + 0.5, voxel.dz + 0.5);
    presetPreviewGroup.add(mesh);
  }
}

function setTool(tool: Tool): void {
  const wasExploring = activeTool === 'explore';
  activeTool = tool;
  if (tool !== 'stamp') {
    selectedPresetId = null;
    rebuildPresetPreview();
  }

  if (tool === 'explore') {
    enterExploreMode();
  } else if (wasExploring) {
    exitExploreMode();
  }

  applyControlMode(tool);
  updateUi();
  updateHover();
}

function activatePlaceTool(): void {
  const existingPreset = getSelectedPreset();
  const fallbackPreset = OBJECT_PRESETS.find((preset) => preset.theme === activeTheme);
  const preset = existingPreset ?? fallbackPreset;

  if (!preset) {
    return;
  }

  activeCategory = categoryForPreset(preset.category);
  selectPreset(preset.id);
  buildAssetGrid();
  updateUi();
}

function applyControlMode(tool: Tool): void {
  controls.enabled = tool !== 'explore';

  if (tool === 'explore') {
    renderer.domElement.style.cursor = 'grab';
    previewMesh.visible = false;
    presetPreviewGroup.visible = false;
    return;
  }

  if (tool === 'pan') {
    controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    renderer.domElement.style.cursor = 'grab';
    return;
  }

  if (tool === 'zoom') {
    controls.mouseButtons.LEFT = THREE.MOUSE.DOLLY;
    renderer.domElement.style.cursor = 'zoom-in';
    return;
  }

  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  renderer.domElement.style.cursor = tool === 'erase' ? 'not-allowed' : 'crosshair';
}

function enterExploreMode(): void {
  pointerDown = null;
  replaceTargetMode = false;
  hoverVoxel = null;
  explorePointerDrag = null;
  previewMesh.visible = false;
  presetPreviewGroup.visible = false;
  avatarGroup.visible = true;
  ensureAvatarOnWalkableGround();
  syncExploreYawFromCamera();
  updateExploreCamera(1);
  document.body.classList.add('is-exploring');
  showToast('Explore mode: WASD move, drag to look, Esc returns');
}

function exitExploreMode(): void {
  exploreMoveKeys.clear();
  explorePointerDrag = null;
  avatarGroup.visible = false;
  document.body.classList.remove('is-exploring');
  controls.target.set(avatarGroup.position.x, avatarGroup.position.y + 1.2, avatarGroup.position.z);
}

function updateUi(): void {
  const preset = getSelectedPreset();
  const toolLabel = activeTool[0].toUpperCase() + activeTool.slice(1);
  statusLine.textContent = activeTool === 'explore'
    ? 'Explore mode'
    : activeTool === 'stamp' && preset
      ? `Stamp - ${preset.label} (${presetRotation * 90} deg, Ctrl replace)`
      : `${toolLabel} - ${BLOCKS[selectedType].label}${activeTool === 'paint' ? ' (Ctrl replace)' : ''}`;
  selectedBlock.textContent = BLOCKS[selectedType].label;
  blockCount.textContent = voxelData.size.toLocaleString();
  brushValue.value = String(brushSize);
  brushInput.disabled = activeTool === 'stamp' || activeTool === 'pan' || activeTool === 'orbit' || activeTool === 'zoom' || activeTool === 'explore';
  activeThemeLabel.textContent = PRESET_THEMES.find((theme) => theme.id === activeTheme)?.label ?? 'Theme';

  document.querySelector('#placeTool')?.classList.toggle('is-active', activeTool === 'stamp');
  document.querySelector('#paintTool')?.classList.toggle('is-active', activeTool === 'paint');
  document.querySelector('#eraseTool')?.classList.toggle('is-active', activeTool === 'erase');
  document.querySelector('#sampleTool')?.classList.toggle('is-active', activeTool === 'sample');
  document.querySelector('#panTool')?.classList.toggle('is-active', activeTool === 'pan');
  document.querySelector('#orbitTool')?.classList.toggle('is-active', activeTool === 'orbit');
  document.querySelector('#zoomTool')?.classList.toggle('is-active', activeTool === 'zoom');

  const exploreButton = document.querySelector<HTMLButtonElement>('#exploreButton');
  if (exploreButton) {
    const exploring = activeTool === 'explore';
    exploreButton.classList.toggle('is-active', exploring);
    exploreButton.setAttribute('aria-pressed', String(exploring));
    exploreButton.setAttribute('aria-label', exploring ? 'Return to editor' : 'Explore map');
    exploreButton.title = exploring ? 'Return to editor' : 'Explore map';
  }

  document.querySelector<HTMLButtonElement>('#undoButton')!.disabled = undoStack.length === 0;
  document.querySelector<HTMLButtonElement>('#redoButton')!.disabled = redoStack.length === 0;
  document.querySelector<HTMLButtonElement>('#rotatePresetButton')!.disabled = activeTool !== 'stamp' || !preset;

  for (const tab of themeTabs.querySelectorAll<HTMLButtonElement>('.theme-tab')) {
    const isActive = tab.dataset.theme === activeTheme;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  }

  for (const tab of categoryTabs.querySelectorAll<HTMLButtonElement>('.category-tab')) {
    const isActive = tab.dataset.category === activeCategory;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  }

  for (const button of assetGrid.querySelectorAll<HTMLButtonElement>('.asset-card')) {
    const activeId = selectedPresetId ? `preset-${selectedPresetId}` : `block-${selectedType}`;
    button.classList.toggle('is-active', button.dataset.asset === activeId);
  }

  updateSunFromSlider();
  updateToggleButton('#ambientToggle', ambientEnabled);
  updateToggleButton('#nightToggle', nightModeEnabled);
  updateToggleButton('#gridToggle', gridEnabled);
  updateToggleButton('#bordersToggle', bordersEnabled);
}

function updateToggleButton(selector: string, enabled: boolean): void {
  const button = document.querySelector<HTMLButtonElement>(selector);
  if (!button) {
    return;
  }

  button.classList.toggle('is-on', enabled);
  button.setAttribute('aria-pressed', String(enabled));
  const label = button.querySelector('strong');
  if (label) {
    label.textContent = enabled ? 'ON' : 'OFF';
  }
}

function updateGridTone(): void {
  gridMaterial.opacity = bordersEnabled ? (nightModeEnabled ? 0.13 : 0.18) : 0.04;
  backgroundGridMaterial.opacity = bordersEnabled ? (nightModeEnabled ? 0.12 : 0.2) : 0.08;
}

function showInstructions(): void {
  showToast('Explore: WASD moves, drag looks, Esc edits. Build: R rotates, Ctrl replaces');
}

function toggleExploreMode(): void {
  setTool(activeTool === 'explore' ? 'orbit' : 'explore');
}

function toggleMusicPlayback(): void {
  musicAutoplayPending = false;

  if (musicPlaying) {
    musicPlayer.pause();
    musicPlaying = false;
    updateMusicControls();
    showToast('Music paused');
    return;
  }

  void startMusicPlayback(true, true);
}

function toggleMusicMute(): void {
  musicMuted = !musicMuted;
  musicPlayer.muted = musicMuted;
  updateMusicControls();
  showToast(musicMuted ? 'Music muted' : 'Music unmuted');
}

function playNextMusicTrack(): void {
  currentMusicTrack = (currentMusicTrack + 1) % MUSIC_TRACKS.length;
  musicPlayer.src = MUSIC_TRACKS[currentMusicTrack];

  if (musicPlaying) {
    void startMusicPlayback(false, false);
  }
}

function resumePendingMusicAutoplay(event: PointerEvent | KeyboardEvent): void {
  if (!musicAutoplayPending || musicPlaying) {
    return;
  }

  if (event.target instanceof Element && event.target.closest('#musicPlayButton')) {
    return;
  }

  if (
    event instanceof KeyboardEvent &&
    (event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement)
  ) {
    return;
  }

  void startMusicPlayback(false, false);
}

async function startMusicPlayback(showStartedToast: boolean, showBlockedToast: boolean): Promise<void> {
  try {
    musicPlayer.muted = musicMuted;
    await musicPlayer.play();
    musicPlaying = true;
    musicAutoplayPending = false;
    updateMusicControls();
    if (showStartedToast) {
      showToast('Background music playing');
    }
  } catch {
    musicPlaying = false;
    updateMusicControls();
    if (showBlockedToast) {
      showToast('Tap play to start the music');
    }
  }
}

function updateMusicControls(): void {
  musicPlayButton.classList.toggle('is-playing', musicPlaying);
  musicPlayButton.setAttribute('aria-pressed', String(musicPlaying));
  musicPlayButton.setAttribute('aria-label', musicPlaying ? 'Pause music' : 'Play music');
  musicPlayButton.title = musicPlaying ? 'Pause music' : 'Play music';

  musicMuteButton.classList.toggle('is-muted', musicMuted);
  musicMuteButton.setAttribute('aria-pressed', String(musicMuted));
  musicMuteButton.setAttribute('aria-label', musicMuted ? 'Unmute music' : 'Mute music');
  musicMuteButton.title = musicMuted ? 'Unmute music' : 'Mute music';
}

function updateSunFromSlider(): void {
  const hour = Number(timeSlider.value);
  const wholeHour = Math.floor(hour);
  const minutes = Math.round((hour - wholeHour) * 60);
  const displayHour = wholeHour % 24;
  timeLabel.textContent = `${displayHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

  nightModeEnabled = hour < 6 || hour >= 20;
  const dayHour = THREE.MathUtils.clamp(hour, 6, 20);
  const arc = THREE.MathUtils.mapLinear(dayHour, 6, 20, 0.18, Math.PI - 0.18);

  if (nightModeEnabled) {
    const moonArc = THREE.MathUtils.mapLinear(hour < 6 ? hour + 24 : hour, 20, 30, 0.35, Math.PI - 0.35);
    sunLight.color.set(0x9fc4ff);
    sunLight.position.set(Math.cos(moonArc) * 34, Math.sin(moonArc) * 28 + 10, -30);
    sunLight.intensity = ambientEnabled ? 0.42 : 0.26;
    hemiLight.color.set(0x6d8fc8);
    hemiLight.groundColor.set(0x121826);
    hemiLight.intensity = ambientEnabled ? 0.72 : 0.42;
    fillLight.color.set(0x537bbd);
    fillLight.intensity = ambientEnabled ? 0.5 : 0.22;
    scene.background = nightSkyTexture;
  } else {
    sunLight.color.set(0xfff0cf);
    sunLight.position.set(Math.cos(arc) * 38, Math.sin(arc) * 42 + 6, 24);
    sunLight.intensity = THREE.MathUtils.mapLinear(Math.sin(arc), 0, 1, 1.6, 3.5);
    hemiLight.color.set(0xe9f4ff);
    hemiLight.groundColor.set(0x6d5a45);
    hemiLight.intensity = ambientEnabled ? 2.1 : 1.35;
    fillLight.color.set(0xbcd8ff);
    fillLight.intensity = ambientEnabled ? 1.1 : 0.45;
    scene.background = daySkyTexture;
  }

  document.body.classList.toggle('is-night', nightModeEnabled);
  lampLightGroup.visible = nightModeEnabled;
  syncMaterialGlow();
  updateGridTone();
}

function saveToBrowser(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toCityFile()));
  showToast('City saved');
}

function loadFromBrowser(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    showToast('No saved city');
    return;
  }

  try {
    const cityFile = JSON.parse(stored) as CityFile;
    applyWithHistory(() => loadCityFile(cityFile));
    showToast('City loaded');
  } catch (error) {
    console.error(error);
    showToast('Saved city could not load');
  }
}

function exportJson(): void {
  const blob = new Blob([JSON.stringify(toCityFile(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'cozy-blocks-map.json';
  link.click();
  URL.revokeObjectURL(url);
  showToast('City exported');
}

function toCityFile(): CityFile {
  const voxels = Array.from(voxelData.entries()).map(([key, type]) => {
    const [x, y, z] = parseKey(key);
    return { x, y, z, type };
  });

  return {
    version: 1,
    gridSize: GRID_SIZE,
    voxels,
  };
}

function loadCityFile(cityFile: CityFile): boolean {
  if (cityFile.version !== 1 || !Array.isArray(cityFile.voxels)) {
    throw new Error('Unsupported city file.');
  }

  voxelData.clear();
  for (const voxel of cityFile.voxels) {
    if (isVoxelType(voxel.type)) {
      setVoxel(Math.round(voxel.x), Math.round(voxel.y), Math.round(voxel.z), voxel.type);
    }
  }

  return true;
}

function isVoxelType(type: string): type is VoxelType {
  return Object.prototype.hasOwnProperty.call(BLOCKS, type);
}

function showToast(message: string): void {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 1800);
}

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  composer.setSize(width, height);
}

function animate(): void {
  const delta = Math.min(clock.getDelta(), 0.05);
  if (activeTool === 'explore') {
    updateExplore(delta);
  } else {
    controls.update();
    updateHover();
  }

  if (nightModeEnabled) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
}
