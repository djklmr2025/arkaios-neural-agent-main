import styled from 'styled-components';

// Evita reenviar props personalizados al DOM (React muestra warnings si se reenvían)
export const Text = styled.div.withConfig({
  shouldForwardProp: (prop) => ![
    'fontSize',
    'color',
    'fontWeight',
    'textAlign',
  ].includes(prop)
})`
  font-size: ${props => props.fontSize ? props.fontSize : '16px'};
  color: ${props => props.color ? props.color : '#000'};
  font-weight: ${props => props.fontWeight ? props.fontWeight : '400'};
  text-align: ${props => props.textAlign ? props.textAlign : 'unset'};
`
