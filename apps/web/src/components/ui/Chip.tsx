import type { ComponentPropsWithoutRef } from 'react';
import styles from './Chip.module.css';

type ChipProps =
  | ({ as?: 'button' } & Omit<ComponentPropsWithoutRef<'button'>, 'type'>)
  | ({ as: 'span' } & ComponentPropsWithoutRef<'span'>);

export default function Chip(props: ChipProps) {
  if (props.as === 'span') {
    const { as: Tag, className, ...spanProps } = props;
    return (
      <Tag
        {...spanProps}
        className={[styles.chip, className].filter(Boolean).join(' ')}
      />
    );
  }

  const { as: Tag = 'button', className, ...buttonProps } = props;
  return (
    <Tag
      {...buttonProps}
      type="button"
      className={[styles.chip, className].filter(Boolean).join(' ')}
    />
  );
}
