declare module 'react-native-draggable-flatlist' {
  import * as React from 'react';
  import { FlatListProps, ViewStyle } from 'react-native';

  export interface RenderItemParams<T> {
    item: T;
    index: number;
    drag: () => void;
    isActive: boolean;
  }

  export interface DraggableFlatListProps<T> extends Omit<FlatListProps<T>, 'renderItem'> {
    data: T[];
    keyExtractor: (item: T, index: number) => string;
    renderItem: (params: RenderItemParams<T>) => React.ReactElement | null;
    onDragEnd?: (params: { data: T[]; from: number; to: number }) => void;
    activationDistance?: number;
    contentContainerStyle?: ViewStyle;
  }

  const DraggableFlatList: <T>(props: DraggableFlatListProps<T>) => React.ReactElement;
  export default DraggableFlatList;
}
